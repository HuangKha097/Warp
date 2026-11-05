import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, Notification, screen, shell, Tray } from 'electron';
import { spawn, ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { convert, findOffice, targets } from './conversion';
import {HoldGesture} from './hold';

app.setName('Warp');
if(process.platform==='win32')app.setAppUserModelId('io.warp.converter');
function enginePath(){return app.isPackaged?path.join(process.resourcesPath,'libreoffice'):path.join(app.getAppPath(),'vendor','libreoffice');}

let win:BrowserWindow, overlay:BrowserWindow, tray:Tray, watcher:ChildProcess|undefined;
const hold=new HoldGesture();
let anchor={x:260,y:260},presentation=0;
let quitting=false, busy=false, selected:string|null=null, result:string|null=null, office:string|null=null;
let message='Chọn file trong Explorer, rồi nhấn Alt + Shift.';
let helperReady=false;
function state(){return {file:selected ? path.basename(selected):null, path:selected, targets:selected?targets(selected):[], busy, result:result?path.basename(result):null, office:!!office, helperReady, message, anchor,presentation};}
function send(){ for(const window of [win,overlay]) if(window && !window.isDestroyed()) window.webContents.send('state',state()); }
async function select(file:string){
  if(busy) return;
  const info=await stat(file);
  if(!info.isFile()) throw new Error('Vui lòng chọn một file, không chọn thư mục.');
  selected=path.resolve(file);result=null;
  message=targets(file).length ? 'Kéo file ở tâm sang định dạng bạn muốn.' : 'Định dạng này chưa được hỗ trợ.'; send();
}
function show(){
  const p=screen.getCursorScreenPoint(), area=screen.getDisplayNearestPoint(p).workArea;
  win.setPosition(Math.max(area.x,Math.min(p.x-310,area.x+area.width-620)),Math.max(area.y,Math.min(p.y-335,area.y+area.height-670)));
  win.show();win.focus();send();
}
function startWatcher(){
  if(process.platform!=='win32'){message='Bản này dành cho Windows.';send();return;}
  const file=app.isPackaged ? path.join(process.resourcesPath,'SelectionWatcher.exe') : path.join(app.getAppPath(),'native','SelectionWatcher.exe');
  watcher=spawn(file,[String(process.pid)],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  watcher.on('error',()=>{helperReady=false;message='Không khởi động được phím tắt. Bạn vẫn có thể chọn file bằng nút bên dưới.';send();});
  createInterface({input:watcher.stdout!}).on('line',async line=>{
    try {
      const event=JSON.parse(line);
      if(event.ready){helperReady=true;send();return;}
      if(event.released){hold.release();overlay.hide();return;}
      if(event.held){hold.press(event.gesture);return;}
      if(busy)return;
      if(event.file && hold.accepts(event.gesture)){
        await select(event.file);
        if(!hold.accepts(event.gesture))return;
        const p=screen.screenToDipPoint({x:event.x,y:event.y});
        const display=screen.getDisplayNearestPoint(p);
        anchor={x:p.x-display.bounds.x,y:p.y-display.bounds.y};
        overlay.setBounds(display.bounds);
        presentation++;win.hide();send();overlay.showInactive();
      }else if(event.error){message=event.error;send();}
    } catch { message='Không đọc được file đang chọn. Hãy thử chọn lại file.';send(); }
  });
  watcher.stderr?.on('data',()=>{});
  watcher.on('exit',()=>{helperReady=false;hold.release();overlay.hide();if(!quitting){message='Bộ nhận phím tắt đã dừng. Hãy khởi động lại ứng dụng.';send();}});
}
if(!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance',()=>{if(win)show();});
  app.whenReady().then(async()=>{
    office=await findOffice(enginePath());
    win=new BrowserWindow({width:620,height:670,icon:path.join(app.getAppPath(),'assets','warp.ico'),frame:false,resizable:false,show:false,backgroundColor:'#181819',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
    win.setMenu(null);
    win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    win.webContents.on('will-navigate',event=>event.preventDefault());
    win.on('close',e=>{if(!quitting){e.preventDefault();win.hide();}});
    overlay=new BrowserWindow({width:520,height:520,transparent:true,frame:false,resizable:false,movable:false,alwaysOnTop:true,skipTaskbar:true,show:false,hasShadow:false,focusable:false,backgroundColor:'#00000000',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
    overlay.setMenu(null);
    overlay.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    overlay.webContents.on('will-navigate',event=>event.preventDefault());
    overlay.on('close',e=>{if(!quitting){e.preventDefault();overlay.hide();}});
    tray=new Tray(nativeImage.createFromPath(path.join(app.getAppPath(),'assets','warp.png')).resize({width:32,height:32}));
    tray.setToolTip('Warp · Alt + Shift');
    tray.setContextMenu(Menu.buildFromTemplate([{label:'Mở Warp',click:show},{type:'separator'},{label:'Thoát',click:()=>{quitting=true;app.quit();}}]));
    tray.on('click',show);
    function trusted(event:Electron.IpcMainInvokeEvent){const owner=[win,overlay].find(w=>w.webContents===event.sender);if(!owner||event.senderFrame!==owner.webContents.mainFrame)throw new Error('Untrusted sender');}
    ipcMain.handle('state',async e=>{trusted(e);office=await findOffice(enginePath());return state();});
    ipcMain.handle('choose',async e=>{trusted(e);if(busy)return;const pick=await dialog.showOpenDialog(win,{properties:['openFile'],filters:[{name:'Tài liệu',extensions:['docx','doc','odt','rtf','txt','xlsx','xls','ods','csv','pptx','ppt','odp']}]});if(!pick.canceled)await select(pick.filePaths[0]);return state();});
    ipcMain.handle('accept',async(e,file:unknown)=>{trusted(e);if(typeof file!=='string'||!path.isAbsolute(file))throw new Error('Đường dẫn không hợp lệ.');await select(file);return state();});
    ipcMain.handle('convert',async(e,target:unknown)=>{
      trusted(e);if(busy)return state();
      const fromOverlay=e.sender===overlay.webContents;
      if(fromOverlay&&!hold.active)return state();
      const input=selected;
      try{
        if(!input||typeof target!=='string'||!targets(input).includes(target))throw new Error('Hãy chọn định dạng phù hợp.');
        office=await findOffice(enginePath());if(!office)throw new Error('Bộ chuyển đổi tích hợp bị thiếu. Hãy tải lại bản Warp đầy đủ.');
        busy=true;result=null;message=`Đang tạo bản ${target.toUpperCase()}…`;send();
        result=await convert(input,target,office);message='Đã tạo bản chuyển đổi. File gốc được giữ nguyên.';
      }catch(error){message=error instanceof Error?error.message:'Chuyển đổi thất bại.';}
      finally{busy=false;send();if(fromOverlay&&Notification.isSupported()){const notice=new Notification({title:result?'Đã chuyển đổi':'Warp',body:result?path.basename(result):message});notice.on('click',()=>{if(result)shell.showItemInFolder(result);else show();});notice.show();}}return state();
    });
    ipcMain.handle('reveal',e=>{trusted(e);if(result)shell.showItemInFolder(result);});
    ipcMain.handle('hide',e=>{trusted(e);BrowserWindow.fromWebContents(e.sender)?.hide();});
    ipcMain.handle('quit',e=>{trusted(e);quitting=true;app.quit();});
    await win.loadFile(path.join(__dirname,'../dist/index.html'));
    await overlay.loadFile(path.join(__dirname,'../dist/index.html'),{query:{mode:'overlay'}});
    startWatcher();show();
  });
}
app.on('before-quit',()=>{quitting=true;watcher?.kill();});
app.on('window-all-closed',()=>{});
