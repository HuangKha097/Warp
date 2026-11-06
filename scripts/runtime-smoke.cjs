// Regression harness: real Electron main/preload/renderer + real bundled converter.
// Only Windows input and tray presentation are substituted, so it does not type
// into the user's Desktop or register an autostart entry on the developer machine.
const electron=require('electron');
const {app,BrowserWindow:RealWindow}=electron;
const {EventEmitter}=require('node:events');
const Module=require('node:module');
const path=require('node:path');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const cache=path.join(root,'.cache/runtime-smoke',String(Date.now()));
require('node:fs').mkdirSync(cache,{recursive:true});
app.setPath('userData',path.join(cache,'profile'));app.setAppPath(root);
let watcher,tray,quit=false;
const windows=[];
class TestWatcher extends EventEmitter {start(){watcher=this;this.emit('event',{ready:true});}stop(){this.stopped=true;}}
class TestTray extends EventEmitter {constructor(){super();tray=this;}setToolTip(value){this.tooltip=value;}setContextMenu(value){this.menu=value;}}
function TestWindow(options){
  const window=new RealWindow({...options,webPreferences:{...options.webPreferences,offscreen:true,backgroundThrottling:false}});
  const item={window,options,visible:false,shows:0};windows.push(item);
  const hide=window.hide.bind(window);window.hide=()=>{item.visible=false;hide();};
  window.showInactive=()=>{item.visible=true;item.shows++;};window.isVisible=()=>item.visible;
  return window;
}
const originalLoad=Module._load;
app.quit=()=>{quit=true;};
Module._load=function(request,parent,isMain){
  if(request==='electron')return {...electron,BrowserWindow:TestWindow,Tray:TestTray,Menu:{buildFromTemplate:items=>items}};
  if(request==='./watcher'&&parent?.filename===path.join(root,'dist-electron/main.js'))return {NativeWatcher:TestWatcher};
  return originalLoad.apply(this,arguments);
};
require(path.join(root,'dist-electron/main.js'));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(condition,timeout=180000){const start=Date.now();while(!await condition()){if(Date.now()-start>timeout)throw new Error('Runtime condition timed out');await delay(50);}}
async function main(){
  await until(()=>watcher&&windows.length===2,15000);
  const overlay=windows[0],status=windows[1];
  const read=()=>overlay.window.webContents.executeJavaScript('window.orbit.state()');
  const convert=()=>overlay.window.webContents.executeJavaScript('window.orbit.convert("pdf")');
  const checks=[];
  assert.ok(windows.every(w=>!w.visible&&w.shows===0&&w.options.skipTaskbar));
  assert.deepEqual(tray.menu.map(item=>item.label),['Exit']);checks.push('startup is tray-only with Exit');
  const a=path.join(cache,'first.txt'),b=path.join(cache,'second.txt'),gone=path.join(cache,'retry.txt');
  await fs.writeFile(a,'Warp first document.');await fs.writeFile(b,'Warp second document.');
  async function select(id,file){watcher.emit('event',{held:true,gesture:id});watcher.emit('event',{file,gesture:id,x:500,y:400});await until(async()=>{const s=await read();return overlay.visible&&s.path===file;},10000);}
  await select(1,a);await convert();assert.equal(overlay.visible,false);assert.equal(status.visible,true);
  const firstState=await read();assert.equal(firstState.job.status,'running');checks.push('conversion hides full-screen overlay and shows progress immediately');
  watcher.emit('event',{released:true});await select(2,b);assert.equal((await read()).busy,false);
  await convert();assert.equal((await read()).job.queued,1);watcher.emit('event',{released:true});
  await until(async()=>{const s=await read();return s.job?.status==='success'&&s.job.completed===2;});
  assert.equal((await read()).path,b);checks.push('second file can open and queue during first conversion; both real PDFs finish');
  for(const file of [a,b]){assert.equal((await fs.readFile(file.replace('.txt','.pdf'))).subarray(0,5).toString(),'%PDF-');}
  await fs.writeFile(gone,'Warp retry document.');await select(3,gone);await fs.unlink(gone);await convert();watcher.emit('event',{released:true});
  await until(async()=>{const s=await read();return s.job?.status==='error';});
  assert.ok((await read()).job.error.includes('Không tìm thấy'));checks.push('conversion failure is visible and does not lock the next hold');
  await fs.writeFile(gone,'Warp retry document.');await select(4,gone);await convert();watcher.emit('event',{released:true});
  await until(async()=>{const s=await read();return s.job?.status==='success'&&s.job.completed===3;});
  checks.push('later conversion succeeds after a real source-file error');
  watcher.emit('reset');assert.equal((await read()).helperReady,false);watcher.emit('event',{ready:true});
  await select(5,b);watcher.emit('event',{released:true});assert.equal(overlay.visible,false);checks.push('helper reset and next gesture recover correctly');
  tray.menu[0].click();assert.ok(quit&&watcher.stopped);checks.push('Exit stops helper and quits');
  await fs.writeFile(path.join(root,'.cache/runtime-check.json'),JSON.stringify({passed:true,checks},null,2));
  console.log('PASS:',checks.join('; '));app.exit(0);
}
main().catch(async error=>{try{tray?.menu?.[0]?.click();await fs.writeFile(path.join(root,'.cache/runtime-check.json'),JSON.stringify({passed:false,error:String(error)}));}finally{console.error(error);app.exit(1);}});
