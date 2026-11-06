// Real main/preload/React and converter; tray, native selection, OS dialogs and
// external navigation are replaced. No autostart entry or Desktop input changes.
const electron=require('electron');
const {app,BrowserWindow:RealWindow}=electron;
const {EventEmitter}=require('node:events');
const Module=require('node:module');
const path=require('node:path');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),cache=path.join(root,'.cache/setup-smoke',String(Date.now()));
require('node:fs').mkdirSync(cache,{recursive:true});
app.setPath('userData',path.join(cache,'profile'));app.setAppPath(root);
app.disableHardwareAcceleration();app.getLocale=()=> 'vi-VN';
let watcher,tray,quit=false,chosenFolder=null,loginChanges=0;
const windows=[],external=[],locations=[],checks=[];
class TestWatcher extends EventEmitter{start(){watcher=this;this.emit('event',{ready:true});}stop(){this.stopped=true;}}
class TestTray extends EventEmitter{constructor(){super();tray=this;}setToolTip(){}setContextMenu(items){this.menu=items;}}
function TestWindow(options){
  const window=new RealWindow({...options,show:false,webPreferences:{...options.webPreferences,offscreen:true,backgroundThrottling:false}});
  const item={window,options,visible:false};windows.push(item);
  window.show=window.showInactive=()=>{item.visible=true;};window.hide=()=>{item.visible=false;};window.isVisible=()=>item.visible;window.focus=()=>{};
  return window;
}
const originalLoad=Module._load;
app.quit=()=>{quit=true;};app.setLoginItemSettings=()=>{loginChanges++;};
Module._load=function(request,parent,isMain){
  if(request==='electron')return {...electron,BrowserWindow:TestWindow,Tray:TestTray,Menu:{buildFromTemplate:items=>items},
    dialog:{showOpenDialog:async()=>chosenFolder?{canceled:false,filePaths:[chosenFolder]}:{canceled:true,filePaths:[]}},
    shell:{openExternal:async url=>{external.push(url);},openPath:async file=>{locations.push(file);return '';},showItemInFolder:file=>locations.push(file)}};
  if(request==='./watcher'&&parent?.filename===path.join(root,'dist-electron/main.js'))return {NativeWatcher:TestWatcher};
  return originalLoad.apply(this,arguments);
};
require(path.join(root,'dist-electron/main.js'));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(condition,timeout=20000){const start=Date.now();while(!await condition()){if(Date.now()-start>timeout)throw new Error('Setup condition timed out');await delay(40);}}
async function main(){
  await until(()=>watcher&&windows.length===3&&windows[2].visible);
  const overlay=windows[0],status=windows[1],companion=windows[2];
  const js=expression=>companion.window.webContents.executeJavaScript(expression);
  const prefs=()=>js('window.warp.settings()');
  const read=()=>overlay.window.webContents.executeJavaScript('window.warp.state()');
  const click=async selector=>{await until(()=>js(`!!document.querySelector(${JSON.stringify(selector)})&&!document.querySelector(${JSON.stringify(selector)}).disabled`));await js(`document.querySelector(${JSON.stringify(selector)}).click()`);await delay(50);};
  const mode=()=>js('new URLSearchParams(location.search).get("mode")');
  await until(()=>js('!!document.querySelector(".onboarding-instruction h1")'));
  assert.equal(await mode(),'onboarding');assert.equal((await prefs()).preferences.outputMode,'source');assert.equal((await prefs()).preferences.onboardingCompleted,false);
  assert.equal(loginChanges,0);checks.push('fresh launch shows approved three-step onboarding; default output is the original folder; development never changes Windows startup');
  companion.window.webContents.debugger.attach('1.3');
  await companion.window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await delay(100);
  assert.ok(await js('document.querySelector(".onboarding-visual>img").src.endsWith(".png")'));
  await click('.motion-button');await delay(80);assert.ok(await js('document.querySelector(".onboarding-visual>img").src.endsWith(".gif")'));
  await click('.motion-button');
  for(let step=0;step<3;step++){
    assert.ok(await js('document.querySelector(".eyebrow").textContent.includes("'+(step+1)+' / 3")'));
    await until(()=>js('[...document.images].every(image=>image.complete&&image.naturalWidth>0)'));
    await fs.writeFile(path.join(cache,`onboarding-${step+1}.png`),(await companion.window.webContents.capturePage()).toPNG());
    await click('.onboarding-navigation .primary-button');await delay(80);
  }
  await until(()=>!companion.visible);
  assert.equal((await prefs()).preferences.onboardingCompleted,true);
  assert.equal(JSON.parse(await fs.readFile(path.join(cache,'profile/settings.json'),'utf8')).onboardingCompleted,true);
  checks.push('GIF/poster motion control works; Finish persists one-time completion and hides to tray');
  tray.menu[0].click();await until(async()=>companion.visible&&await mode()==='settings'&&await js('!!document.querySelector(".output-options")'));
  assert.equal(await js('document.querySelector("input[value=source]").checked'),true);
  await delay(250);
  await fs.writeFile(path.join(cache,'settings-default-vi.png'),(await companion.window.webContents.capturePage()).toPNG());
  for(const [width,height] of [[800,760],[560,580],[375,800]]){
    companion.window.setSize(width,height);await delay(120);
    assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'),`settings overflow at ${width}`);
  }
  companion.window.setSize(800,760);
  await click('.directory-choice button');assert.equal((await prefs()).preferences.outputMode,'source');
  chosenFolder=path.join(cache,'Bản chuyển đổi');await fs.mkdir(chosenFolder);
  await click('.directory-choice button');await until(async()=>(await prefs()).preferences.outputMode==='custom');
  assert.equal((await prefs()).preferences.outputDirectory,chosenFolder);
  checks.push('Settings starts with same-folder radio checked; cancel preserves it; native picker persists a custom folder; layout fits narrow windows');
  const input=path.join(cache,'Tài liệu thử.txt');await fs.writeFile(input,'Warp onboarding and preferences.');
  watcher.emit('event',{held:true,gesture:1});watcher.emit('event',{file:input,gesture:1,x:500,y:400});
  await until(async()=>overlay.visible&&(await read()).path===input);
  await overlay.window.webContents.executeJavaScript('window.warp.convert("pdf")');watcher.emit('event',{released:true});
  await until(async()=>(await read()).job?.status==='success',180000);
  const output=(await read()).job.output;assert.equal(path.dirname(output),chosenFolder);
  assert.equal((await fs.readFile(output)).subarray(0,5).toString(),'%PDF-');assert.equal(await fs.readFile(input,'utf8'),'Warp onboarding and preferences.');
  checks.push('real PDF conversion uses the selected output folder and preserves the original');
  await click('input[value=source]');await until(async()=>(await prefs()).preferences.outputMode==='source');
  await js(`(()=>{const select=document.querySelector('#language');select.value='en';select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await until(async()=>(await prefs()).preferences.language==='en');
  assert.equal(await js('document.querySelector(".settings-content h1").textContent'),'Settings');
  assert.equal((await read()).language,'en');assert.equal(tray.menu[0].label,'Settings…');
  assert.ok(await status.window.webContents.executeJavaScript('document.querySelector(".progress-heading").textContent.includes("Converted copy is ready")'));
  await delay(250);
  await fs.writeFile(path.join(cache,'settings-en.png'),(await companion.window.webContents.capturePage()).toPNG());
  await click('.settings-help button:nth-of-type(2)');
  assert.deepEqual(external,['https://github.com/HuangKha097/Warp/blob/main/LICENSE']);
  await click('.location-row .quiet-button');await until(()=>locations.includes(root));
  await assert.rejects(overlay.window.webContents.executeJavaScript('window.warp.updateSettings({language:"vi"})'),/Untrusted sender/);
  checks.push('English updates Settings, tray, overlay state and progress immediately; license opens only the fixed GitHub URL; overlay cannot change preferences');
  tray.menu[1].click();await until(async()=>await mode()==='onboarding'&&await js('!!document.querySelector(".onboarding-instruction")'));
  assert.equal((await prefs()).preferences.onboardingCompleted,true);
  assert.equal(await js('document.querySelector("h1").textContent'),'Choose your document');
  await click('.companion-header .quiet-button');await until(()=>!companion.visible);
  assert.equal((await prefs()).preferences.outputMode,'source');
  checks.push('guide reopens from tray in the saved language; Skip returns to tray without resetting preferences');
  const exit=tray.menu.find(item=>item.label==='Exit');exit.click();assert.ok(quit&&watcher.stopped);
  await fs.writeFile(path.join(root,'.cache/setup-check.json'),JSON.stringify({passed:true,checks,previews:cache},null,2));
  console.log('PASS:',checks.join('; '));app.exit(0);
}
main().catch(async error=>{try{await fs.writeFile(path.join(root,'.cache/setup-check.json'),JSON.stringify({passed:false,error:String(error),checks,previews:cache}));if(windows[2])await fs.writeFile(path.join(cache,'failure.png'),(await windows[2].window.webContents.capturePage()).toPNG());}finally{console.error(error);app.exit(1);}});
