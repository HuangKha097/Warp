import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {spawn,type ChildProcess} from 'node:child_process';
import {NativeWatcher} from '../electron/watcher';
const until=async(condition:()=>boolean)=>{const start=Date.now();while(!condition()){if(Date.now()-start>6000)throw new Error('Watcher did not recover');await new Promise(resolve=>setTimeout(resolve,25));}};
test('a stopped native helper restarts automatically; Exit prevents further restarts',async t=>{
  const children:ChildProcess[]=[];let ready=0,resets=0;
  const watcher=new NativeWatcher('fixture',()=>{const child=spawn(process.execPath,[path.resolve('tests/fixtures/watcher.cjs')],{windowsHide:true,stdio:['ignore','pipe','pipe']});children.push(child);return child;});
  t.after(()=>watcher.stop());watcher.on('event',event=>{if(event.ready)ready++;});watcher.on('reset',()=>resets++);
  watcher.start();await until(()=>ready===1);children[0].kill();await until(()=>ready===2);
  assert.equal(resets,1);assert.equal(children.length,2);
  watcher.stop();await new Promise(resolve=>setTimeout(resolve,650));assert.equal(children.length,2);
});
