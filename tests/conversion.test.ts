import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,readdir} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {targets,copyUnique,convert,findOffice} from '../electron/conversion';

test('only offers compatible targets, case insensitive',()=>{
  assert.deepEqual(targets('C:/Báo cáo.DOCX'),['pdf','txt','odt']);
  assert.deepEqual(targets('photo.png'),[]);
  assert.ok(!targets('report.docx').includes('xlsx'));
});
test('concurrent outputs cannot overwrite the original or existing copies',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'orbit-test-'));
  try{
    const original=path.join(dir,'Báo cáo.docx'),existing=path.join(dir,'Báo cáo.pdf'),source=path.join(dir,'converted.tmp');
    await writeFile(original,'ORIGINAL');await writeFile(existing,'EXISTING');await writeFile(source,'PDF');
    const results=await Promise.all([copyUnique(source,original,'pdf'),copyUnique(source,original,'pdf')]);
    assert.equal(new Set(results).size,2);
    assert.equal(await readFile(original,'utf8'),'ORIGINAL');assert.equal(await readFile(existing,'utf8'),'EXISTING');
    for(const result of results)assert.equal(await readFile(result,'utf8'),'PDF');
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('rejects unsupported conversion before launching a process',async()=>{
  await assert.rejects(convert('report.docx','xlsx','does-not-exist'),/không được hỗ trợ/);
});
test('failed converter leaves original intact and produces no output',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'orbit-test-'));
  try{
    const original=path.join(dir,'original.docx');await writeFile(original,'ORIGINAL');
    await assert.rejects(convert(original,'pdf',path.join(dir,'missing.exe')));
    assert.equal(await readFile(original,'utf8'),'ORIGINAL');assert.deepEqual(await readdir(dir),['original.docx']);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('prefers the bundled engine without requiring a system installation',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'warp-engine-test-'));
  try{
    const {mkdir}=await import('node:fs/promises');
    await mkdir(path.join(dir,'program'));
    const executable=path.join(dir,'program','soffice.com');await writeFile(executable,'fixture');
    assert.equal(await findOffice(dir),executable);
  }finally{await rm(dir,{recursive:true,force:true});}
});
