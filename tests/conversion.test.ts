import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,readdir} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {targets,copyUnique,convert,findOffice} from '../electron/conversion';

test('only offers compatible targets, case insensitive',()=>{
  assert.deepEqual(targets('C:/Báo cáo.DOCX'),['pdf','txt','odt']);
  assert.deepEqual(targets('photo.png'),[]);
  assert.ok(!targets('report.docx').includes('xlsx'));
});
test('concurrent outputs cannot overwrite the original or existing copies',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'warp-test-'));
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

test('custom destination preserves source and existing files, including concurrent copies',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'warp-custom-'));
  try{
    const output=path.join(dir,'chosen');await mkdir(output);
    const original=path.join(dir,'Báo cáo.docx'),source=path.join(dir,'converted.tmp'),existing=path.join(output,'Báo cáo.pdf');
    await writeFile(original,'ORIGINAL');await writeFile(source,'NEW');await writeFile(existing,'EXISTING');
    const copies=await Promise.all([copyUnique(source,original,'pdf',output),copyUnique(source,original,'pdf',output)]);
    assert.equal(new Set(copies).size,2);assert.ok(copies.every(file=>path.dirname(file)===output));
    assert.equal(await readFile(existing,'utf8'),'EXISTING');assert.equal(await readFile(original,'utf8'),'ORIGINAL');
    assert.ok(!(await readdir(dir)).includes('Báo cáo.pdf'));
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('failed converter leaves original intact and produces no output',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'warp-test-'));
  try{
    const original=path.join(dir,'original.docx');await writeFile(original,'ORIGINAL');
    await assert.rejects(convert(original,'pdf',path.join(dir,'missing.exe')));
    assert.equal(await readFile(original,'utf8'),'ORIGINAL');assert.deepEqual(await readdir(dir),['original.docx']);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('a removed custom folder reports the destination error before starting the converter',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'warp-missing-output-'));
  try{
    const input=path.join(dir,'original.txt');await writeFile(input,'ORIGINAL');
    await assert.rejects(convert(input,'pdf','unused.exe',{outputDirectory:path.join(dir,'removed')}),/thư mục lưu đã chọn/);
    assert.equal(await readFile(input,'utf8'),'ORIGINAL');
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
