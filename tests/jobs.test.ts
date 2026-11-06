import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JobQueue} from '../electron/jobs';
import {SelectionSession} from '../electron/selection';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function deferred<T>(){let resolve!:(value:T)=>void;let reject!:(error:Error)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
test('a second selected file opens and queues while the first conversion is still finishing',async()=>{
  const first=deferred<string>(),second=deferred<string>();const started:string[]=[];
  const selection=new SelectionSession();
  const queue=new JobQueue(input=>{started.push(input);return started.length===1?first.promise:second.promise;},()=>{});
  selection.press(1);await selection.capture(1,{file:'A.docx',x:10,y:20},async()=>{});
  const a=queue.enqueue(selection.current!.file,'pdf');selection.release();
  selection.press(2);assert.ok(await selection.capture(2,{file:'B.docx',x:20,y:30},async()=>{}));
  assert.equal(queue.hasInput(selection.current!.file),false);assert.equal(selection.current!.file,'B.docx');
  const b=queue.enqueue(selection.current!.file,'pdf');selection.release();
  assert.equal(a.status,'running');assert.equal(b.status,'queued');assert.equal(started.length,1);
  first.resolve('A.pdf');await flush();
  assert.equal(a.status,'success');assert.equal(b.status,'running');assert.equal(selection.current!.file,'B.docx');
  second.resolve('B.pdf');await flush();assert.equal(b.status,'success');assert.equal(queue.hasInput('B.docx'),false);
  selection.press(3);assert.ok(await selection.capture(3,{file:'C.docx',x:30,y:40},async()=>{}));
  assert.ok(selection.active);queue.dispose();
});
test('an error does not lock the queue; retry and later conversions can succeed',async()=>{
  let attempt=0;const queue=new JobQueue(async()=>{if(attempt++===0)throw Object.assign(new Error('denied'),{code:'EACCES'});return 'copy.pdf';},()=>{});
  const failed=queue.enqueue('A.docx','pdf');await flush();
  assert.equal(failed.status,'error');assert.match(failed.error!,/quyền/);assert.equal(queue.failures.length,1);
  const next=queue.enqueue('B.docx','pdf');await flush();assert.equal(next.status,'success');
  const retry=queue.enqueue('A.docx','pdf');await flush();assert.equal(retry.status,'success');assert.equal(queue.failures.length,0);queue.dispose();
});
test('duplicate submissions do not create duplicate work and Exit cancels only active work',async()=>{
  let signal:AbortSignal|undefined;
  const queue=new JobQueue((_,__,___,abort)=>{signal=abort;return new Promise((_,reject)=>abort.addEventListener('abort',()=>reject(new Error('aborted'))));},()=>{});
  const a=queue.enqueue('A.docx','pdf');assert.equal(queue.enqueue('A.docx','pdf'),a);
  const b=queue.enqueue('B.docx','pdf');queue.dispose();await flush();
  assert.ok(signal!.aborted);assert.equal(b.status,'queued');assert.throws(()=>queue.enqueue('C.docx','pdf'),/thoát/);
});
test('late selection lookups cannot replace a newer file or reopen a released orbit',async()=>{
  const selection=new SelectionSession(),slow=deferred<void>();
  selection.press(1);const old=selection.capture(1,{file:'A.docx',x:1,y:1},()=>slow.promise);
  selection.release();selection.press(2);await selection.capture(2,{file:'B.docx',x:2,y:2},async()=>{});
  slow.resolve();assert.equal(await old,false);assert.equal(selection.current!.file,'B.docx');
  selection.release();assert.equal(await selection.capture(2,{file:'C.docx',x:3,y:3},async()=>{}),false);
});
