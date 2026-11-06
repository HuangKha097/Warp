import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {PreferencesStore} from '../electron/preferences';

test('fresh preferences default to the source folder; completion and language persist across restarts',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'warp-settings-'));
  try{
    const file=path.join(dir,'settings.json'),store=new PreferencesStore(file,'vi-VN');
    await store.load();
    assert.equal(store.current.outputMode,'source');assert.equal(store.current.outputDirectory,null);
    assert.equal(store.current.onboardingCompleted,false);assert.equal(store.current.language,'vi');
    await Promise.all([store.update({language:'en'}),store.completeOnboarding(),store.update({launchAtLogin:false})]);
    const restored=new PreferencesStore(file);await restored.load();
    assert.deepEqual(restored.current,{language:'en',launchAtLogin:false,outputMode:'source',outputDirectory:null,onboardingCompleted:true});
    assert.equal(JSON.parse(await readFile(file,'utf8')).schemaVersion,1);
    assert.ok(!(await readdir(dir)).includes('settings.json.tmp'));
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('invalid or inaccessible destinations and unknown settings cannot replace valid preferences',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'warp-settings-'));
  try{
    const store=new PreferencesStore(path.join(dir,'settings.json'));await store.load();await store.update({});
    await assert.rejects(store.update({outputMode:'custom'}),/CHOOSE_DIRECTORY/);
    await assert.rejects(store.update({outputDirectory:'relative',outputMode:'custom'}),/INVALID_DIRECTORY/);
    await assert.rejects(store.update({onboardingCompleted:true}),/INVALID_SETTINGS/);
    await assert.rejects(store.update({language:'fr'}),/INVALID_SETTINGS/);
    await assert.rejects(store.update({launchAtLogin:'yes'}),/INVALID_SETTINGS/);
    const notFolder=path.join(dir,'not-a-folder');await writeFile(notFolder,'file');
    await assert.rejects(store.update({outputMode:'custom',outputDirectory:notFolder}),/INVALID_DIRECTORY/);
    await assert.rejects(store.update({outputMode:'custom',outputDirectory:path.join(dir,'missing')}));
    assert.equal(store.current.outputMode,'source');
    await store.update({outputMode:'custom',outputDirectory:dir});
    assert.equal(store.current.outputDirectory,dir);
    await store.update({outputMode:'source'});
    assert.equal(store.current.outputMode,'source');assert.equal(store.current.outputDirectory,dir);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('damaged settings are backed up and safe defaults recover',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'warp-settings-'));
  try{
    const file=path.join(dir,'settings.json');await writeFile(file,'{damaged');
    const store=new PreferencesStore(file,'en-US');await store.load();
    assert.equal(store.current.language,'en');assert.equal(store.current.outputMode,'source');
    assert.ok((await readdir(dir)).some(name=>name.startsWith('settings.json.invalid-')));
    await store.update({language:'vi'});assert.equal(JSON.parse(await readFile(file,'utf8')).language,'vi');
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('an unavailable custom folder does not block language or startup changes',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'warp-settings-'));
  try{
    const file=path.join(dir,'settings.json');
    await writeFile(file,JSON.stringify({outputMode:'custom',outputDirectory:path.join(dir,'removed')}));
    const store=new PreferencesStore(file);await store.load();
    await store.update({language:'en',launchAtLogin:false});
    assert.equal(store.current.language,'en');assert.equal(store.current.launchAtLogin,false);
    await store.update({outputMode:'source'});assert.equal(store.current.outputMode,'source');
  }finally{await rm(dir,{recursive:true,force:true});}
});
