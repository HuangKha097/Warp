import {app,BrowserWindow,dialog,ipcMain,Menu,nativeImage,screen,shell,Tray} from 'electron';
import {stat,appendFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {convert,findOffice,targets} from './conversion';
import {JobQueue,type Job} from './jobs';
import {SelectionSession} from './selection';
import {NativeWatcher,type WatchEvent} from './watcher';
import type {AppState,ProgressState,SettingsState,SettingsResult} from './contracts';
import {PreferencesStore} from './preferences';

app.setName('Warp');
if(process.platform==='win32')app.setAppUserModelId('io.warp.converter');
const selection=new SelectionSession();
let overlay:BrowserWindow,statusWindow:BrowserWindow,tray:Tray,watcher:NativeWatcher;
let companion:BrowserWindow|undefined,preferences:PreferencesStore;
let quitting=false,helperReady=false,presentation=0;
let anchor={x:260,y:260};
let progress:ProgressState|null=null;
let dismissedId=-1,shownId=-1;
let closeTimer:ReturnType<typeof setTimeout>|undefined;
function enginePath(){return app.isPackaged?path.join(process.resourcesPath,'libreoffice'):path.join(app.getAppPath(),'vendor','libreoffice');}
function diagnostic(event:string){void appendFile(path.join(app.getPath('userData'),'runtime.log'),`${new Date().toISOString()} ${event}\n`).catch(()=>{});}
function state():AppState{const file=selection.current?.file??null;return {file:file?path.basename(file):null,path:file,targets:file?targets(file):[],busy:queue.hasInput(file),helperReady,anchor,presentation,job:progress,language:preferences?.current.language??'vi'};}
const licenseURL='https://github.com/HuangKha097/Warp/blob/main/LICENSE';
function settings():SettingsState{
  const value=preferences.current;
  if(app.isPackaged)value.launchAtLogin=app.getLoginItemSettings({path:process.execPath,args:['--background']}).executableWillLaunchAtLogin;
  return {preferences:value,version:app.getVersion(),installDirectory:app.isPackaged?path.dirname(process.execPath):app.getAppPath(),settingsFile:preferences.file,packaged:app.isPackaged};
}
function sendSettings(){
  if(companion&&!companion.isDestroyed())companion.webContents.send('settings-changed',settings());
  send();updateTray();
}
function updateTray(){
  const en=preferences.current.language==='en';
  tray.setContextMenu(Menu.buildFromTemplate([
    {label:en?'Settings…':'Cài đặt…',click:()=>void showCompanion('settings')},
    {label:en?'Quick guide…':'Hướng dẫn sử dụng…',click:()=>void showCompanion('onboarding')},
    {type:'separator'}, {label:'Exit',click:exit}
  ]));
}
async function showCompanion(page:'settings'|'onboarding'){
  if(quitting)return;
  if(!companion||companion.isDestroyed()){
    const area=screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
    companion=new BrowserWindow({width:Math.min(800,area.width),height:Math.min(790,area.height),minWidth:Math.min(560,area.width),minHeight:Math.min(580,area.height),show:false,hasShadow:false,backgroundColor:'#181818',autoHideMenuBar:true,title:'Warp',icon:path.join(app.getAppPath(),'assets','warp.ico'),webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
    configure(companion);
  }
  overlay.hide();selection.release();
  await companion.loadFile(path.join(__dirname,'../dist/index.html'),{query:{mode:page}});
  if(!quitting){companion.show();companion.focus();}
}
function send(){if(quitting)return;for(const window of [overlay,statusWindow])if(window&&!window.isDestroyed())window.webContents.send('state',state());}
function showProgress(force=false){
  if(quitting||!progress||statusWindow.isDestroyed())return;
  if(dismissedId===progress.id&&!force)return;
  if(shownId!==progress.id||!statusWindow.isVisible()){
    const area=screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
    statusWindow.setPosition(Math.max(area.x,area.x+area.width-386),Math.max(area.y,area.y+area.height-244));
    shownId=progress.id;
  }
  statusWindow.showInactive();
  if(overlay.isVisible())overlay.moveTop();
}
function jobChanged(job:Job){
  if(quitting)return;
  clearTimeout(closeTimer);
  const visible=queue.jobs.find(j=>j.status==='running')??job;
  progress={...visible,name:path.basename(visible.input),queued:queue.pendingCount,completed:queue.jobs.filter(j=>j.status==='success').length,failures:queue.failures.map(j=>({name:path.basename(j.input),error:j.error??'Chuyển đổi không thành công.'})).slice(-3)};
  const terminal=visible.status==='success'||visible.status==='error';
  if(terminal)dismissedId=-1;
  send();showProgress(terminal);
  tray.setToolTip(terminal?'Warp · Alt + Shift':`Warp · ${preferences.current.language==='en'?'Converting':'Đang chuyển đổi'} ${progress.name}`);
  if(visible.status==='success'){
    const id=visible.id;closeTimer=setTimeout(()=>{if(progress?.id===id&&progress.status==='success')statusWindow.hide();},8000);
  }
}
const queue=new JobQueue(async(input,target,onProgress,signal,outputDirectory)=>{
  const office=await findOffice(enginePath());
  if(!office)throw new Error('Thiếu bộ chuyển đổi tích hợp. Hãy cài lại bản Warp đầy đủ.');
  return convert(input,target,office,{progress:onProgress,signal,outputDirectory});
},jobChanged);
function warning(error:string){
  if(queue.jobs.some(j=>j.status==='running'))return;
  progress={id:0,input:'',name:'Không thể mở vòng tròn',target:'',status:'error',phase:'preparing',startedAt:0,error,queued:0,completed:0,failures:[]};
  dismissedId=-1;send();showProgress(true);
}
async function handleWatch(event:WatchEvent){
  if(event.ready){helperReady=true;tray.setToolTip('Warp · Alt + Shift');diagnostic('watcher-ready');send();return;}
  if(event.released){selection.release();overlay.hide();return;}
  if(event.held&&typeof event.gesture==='number'){overlay.hide();selection.press(event.gesture);return;}
  if(event.error){if(typeof event.gesture==='number'&&selection.accepts(event.gesture))warning(event.error);return;}
  if(!event.file||typeof event.gesture!=='number'||!Number.isFinite(event.x)||!Number.isFinite(event.y))return;
  const accepted=await selection.capture(event.gesture,{file:path.resolve(event.file),x:event.x!,y:event.y!},async file=>{
    if(!(await stat(file)).isFile())throw new Error('Vui lòng chọn một tệp có trên ổ đĩa.');
  });
  if(!accepted)return;
  const point=screen.screenToDipPoint({x:event.x!,y:event.y!});
  const display=screen.getDisplayNearestPoint(point);
  const area=display.workArea;
  anchor={x:point.x-area.x,y:point.y-area.y};
  overlay.setBounds(area);presentation++;
  send();overlay.showInactive();diagnostic(`orbit-shown ${presentation}`);
}
function exit(){quitting=true;clearTimeout(closeTimer);selection.release();watcher?.stop();queue.dispose();app.quit();}
function configure(window:BrowserWindow){
  window.setMenu(null);window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',event=>event.preventDefault());
  window.on('close',event=>{if(!quitting){event.preventDefault();window.hide();}});
  window.webContents.on('render-process-gone',()=>{window.hide();diagnostic('renderer-restarting');if(!quitting)void window.reload();});
  window.webContents.on('did-finish-load',()=>{send();if(preferences)window.webContents.send('settings-changed',settings());});
}
if(!app.requestSingleInstanceLock())app.quit();
else{
  app.on('second-instance',(_event,argv)=>{if(preferences&&!argv.includes('--background'))void showCompanion(preferences.current.onboardingCompleted?'settings':'onboarding');});
  app.whenReady().then(async()=>{
    const initialLocale=app.isPackaged?await readFile(path.join(path.dirname(process.execPath),'installer-language'),'utf8').catch(()=>app.getLocale()):app.getLocale();
    preferences=new PreferencesStore(path.join(app.getPath('userData'),'settings.json'),initialLocale.trim());
    await preferences.load();
    if(!preferences.existed){
      if(app.isPackaged){
        // Existing pre-Settings profiles keep the Windows startup choice too.
        const previousProfile=await stat(path.join(app.getPath('userData'),'runtime.log')).then(()=>true).catch(()=>false);
        if(previousProfile)await preferences.update({launchAtLogin:settings().preferences.launchAtLogin});
        else app.setLoginItemSettings({openAtLogin:true,enabled:true,path:process.execPath,args:['--background'],name:'Warp'});
      }
      await preferences.update({});
    }
    const rendererPreferences={preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true};
    overlay=new BrowserWindow({width:520,height:520,transparent:true,frame:false,thickFrame:false,resizable:false,movable:false,alwaysOnTop:true,skipTaskbar:true,show:false,hasShadow:false,focusable:false,backgroundColor:'#00000000',webPreferences:rendererPreferences});
    statusWindow=new BrowserWindow({width:370,height:228,transparent:true,frame:false,thickFrame:false,hasShadow:false,resizable:false,alwaysOnTop:true,skipTaskbar:true,show:false,focusable:false,backgroundColor:'#00000000',webPreferences:rendererPreferences});
    configure(overlay);configure(statusWindow);
    tray=new Tray(nativeImage.createFromPath(path.join(app.getAppPath(),'assets','warp.ico')));
    tray.setToolTip('Warp · Alt + Shift');
    updateTray();
    tray.on('click',()=>{if(progress){dismissedId=-1;showProgress(true);}});
    function trusted(event:Electron.IpcMainInvokeEvent){const owner=[overlay,statusWindow,companion].find(w=>w&&!w.isDestroyed()&&w.webContents===event.sender);if(!owner||event.senderFrame!==owner.webContents.mainFrame)throw new Error('Untrusted sender');}
    function trustedCompanion(event:Electron.IpcMainInvokeEvent){trusted(event);if(event.sender!==companion?.webContents)throw new Error('Untrusted sender');}
    ipcMain.handle('settings',event=>{trustedCompanion(event);return settings();});
    ipcMain.handle('update-settings',async(event,patch:unknown):Promise<SettingsResult>=>{
      trustedCompanion(event);
      const previous=settings().preferences;
      try{
        if(patch&&typeof patch==='object'&&'launchAtLogin' in patch&&!app.isPackaged)throw new Error('STARTUP_PACKAGED_ONLY');
        await preferences.update(patch);
        if(patch&&typeof patch==='object'&&'launchAtLogin' in patch){
          try{app.setLoginItemSettings({openAtLogin:preferences.current.launchAtLogin,enabled:preferences.current.launchAtLogin,path:process.execPath,args:['--background'],name:'Warp'});}
          catch(error){await preferences.update({launchAtLogin:previous.launchAtLogin});throw error;}
        }
        sendSettings();return {ok:true,value:settings()};
      }catch(error){return {ok:false,error:error instanceof Error?error.message:String(error)};}
    });
    ipcMain.handle('choose-output-directory',async(event):Promise<SettingsResult>=>{
      trustedCompanion(event);
      try{
        const chosen=await dialog.showOpenDialog(companion!,{properties:['openDirectory','createDirectory'],defaultPath:preferences.current.outputDirectory??app.getPath('documents')});
        if(!chosen.canceled&&chosen.filePaths[0]){await preferences.update({outputDirectory:chosen.filePaths[0],outputMode:'custom'});sendSettings();}
        return {ok:true,value:settings()};
      }catch(error){return {ok:false,error:error instanceof Error?error.message:String(error)};}
    });
    ipcMain.handle('finish-onboarding',async event=>{trustedCompanion(event);await preferences.completeOnboarding();companion?.hide();sendSettings();});
    ipcMain.handle('open-license',async event=>{trustedCompanion(event);await shell.openExternal(licenseURL);});
    ipcMain.handle('open-location',async(event,location:unknown)=>{trustedCompanion(event);if(location==='settings')shell.showItemInFolder(preferences.file);else if(location==='install')await shell.openPath(settings().installDirectory);});
    ipcMain.handle('show-companion',async(event,page:unknown)=>{trustedCompanion(event);if(page==='settings'||page==='onboarding')await showCompanion(page);});
    ipcMain.handle('state',event=>{trusted(event);return state();});
    ipcMain.handle('convert',(event,target:unknown)=>{
      trusted(event);
      if(event.sender!==overlay.webContents||!selection.active) return state();
      const input=selection.current?.file;
      if(!input||typeof target!=='string'||!targets(input).includes(target))return state();
      // Native hide releases mouse capture immediately; no invisible full-screen layer
      // is left above Explorer while LibreOffice finishes in the background.
      overlay.hide();selection.release();
      const p=preferences.current;
      queue.enqueue(input,target,p.outputMode==='custom'?p.outputDirectory??undefined:undefined);return state();
    });
    ipcMain.handle('reveal',event=>{trusted(event);if(progress?.output)shell.showItemInFolder(progress.output);});
    ipcMain.handle('retry',event=>{trusted(event);const failed=queue.failures.at(-1);if(failed)queue.enqueue(failed.input,failed.target,failed.outputDirectory);return state();});
    ipcMain.handle('hide',event=>{trusted(event);if(event.sender===statusWindow.webContents){dismissedId=progress?.id??-1;clearTimeout(closeTimer);}else selection.release();BrowserWindow.fromWebContents(event.sender)?.hide();});
    await overlay.loadFile(path.join(__dirname,'../dist/index.html'),{query:{mode:'overlay'}});
    await statusWindow.loadFile(path.join(__dirname,'../dist/index.html'),{query:{mode:'status'}});
    watcher=new NativeWatcher(app.isPackaged?path.join(process.resourcesPath,'SelectionWatcher.exe'):path.join(app.getAppPath(),'native','SelectionWatcher.exe'));
    watcher.on('event',(event:WatchEvent)=>{void handleWatch(event).catch(()=>warning('Không đọc được tệp đang chọn. Hãy chọn lại tệp rồi giữ Alt + Shift.'));});
    watcher.on('reset',()=>{helperReady=false;selection.release();overlay.hide();diagnostic('watcher-restarting');send();});
    watcher.start();diagnostic('started-tray-only');
    if(!preferences.current.onboardingCompleted&&!process.argv.includes('--background'))await showCompanion('onboarding');
  }).catch(error=>{diagnostic(`startup-error ${error instanceof Error?error.name:'unknown'}`);exit();});
}
app.on('before-quit',()=>{quitting=true;clearTimeout(closeTimer);watcher?.stop();queue.dispose();});
app.on('window-all-closed',()=>{});
