const {app,BrowserWindow,ipcMain}=require('electron');
const path=require('node:path');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
app.whenReady().then(async()=>{
  const conversions=[],checks=[];
  ipcMain.handle('fixture-convert',(_,format)=>{conversions.push(format);});
  const win=new BrowserWindow({width:1000,height:800,show:false,backgroundColor:'#141414',webPreferences:{offscreen:true,backgroundThrottling:false,preload:path.join(__dirname,'fixture-preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false}});
  const js=expression=>win.webContents.executeJavaScript(expression);
  const scale=index=>js(`parseFloat(document.querySelectorAll('.dock-magnifier')[${index}].style.getPropertyValue('--dock-scale'))`);
  async function load(overlay){await win.loadFile(path.join(__dirname,'../dist/index.html'),{query:overlay?{mode:'overlay'}:{}});await delay(450);}
  async function drag(x,y){for(const event of [{type:'mouseDown',x:500,y:400,button:'left',clickCount:1},{type:'mouseMove',x,y,button:'left'},{type:'mouseUp',x,y,button:'left',clickCount:1}]){win.webContents.sendInputEvent(event);await delay(70);}}
  async function snapshot(name,rect){await fs.writeFile(path.join(__dirname,`../../${name}`),(await win.webContents.capturePage(rect)).toPNG());}
  try{
    await load(true);
    assert.equal(await js('document.querySelectorAll(".radial-sector").length'),6);
    checks.push('six contiguous annular slices');
    await snapshot('Warp-preview.png',{x:270,y:170,width:460,height:460});
    win.webContents.sendInputEvent({type:'mouseMove',x:500,y:239});await delay(600);
    const magnified=await scale(0);assert.ok(magnified>1.18,`PDF should magnify: ${magnified}`);
    assert.ok((await scale(5))>1.015,'neighboring enabled icon should respond');
    assert.equal(await scale(1),1,'disabled icon must stay still');
    await snapshot('Warp-hover-preview.png',{x:270,y:170,width:460,height:460});
    checks.push('proximity spring magnification and neighbor falloff');
    win.webContents.sendInputEvent({type:'mouseMove',x:20,y:20});await delay(850);
    assert.equal(await scale(0),1);checks.push('spring settles to rest after leaving');
    await drag(500,230);await delay(100);assert.deepEqual(conversions,['pdf']);checks.push('drag to PDF submits once');
    await drag(648,315);assert.deepEqual(conversions,['pdf']);checks.push('disabled Word slice rejects drop');
    win.webContents.debugger.attach('1.3');
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    win.webContents.sendInputEvent({type:'mouseMove',x:500,y:239});await delay(200);
    assert.equal(await scale(0),1);checks.push('reduced motion disables magnification');
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[]});
    win.webContents.debugger.detach();
    win.setSize(620,670);await load(false);
    await snapshot('Warp-app-preview.png');
    assert.ok(await js(`(()=>{const r=document.querySelector('footer').getBoundingClientRect();return r.bottom<=innerHeight&&r.left>=0;})()`),'footer must fit desktop window');
    assert.equal(await js(`document.querySelector('.brand img').naturalWidth`),256);checks.push('updated logo loads and desktop layout fits');
    win.setSize(390,720);await delay(250);
    assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'),'compact window must not overflow');
    await snapshot('Warp-compact-preview.png');checks.push('compact layout has no horizontal overflow');
    await fs.mkdir(path.join(__dirname,'../.cache'),{recursive:true});
    await fs.writeFile(path.join(__dirname,'../.cache/visual-check.json'),JSON.stringify({passed:true,conversions,checks},null,2));
    console.log('PASS:',checks.join('; '));win.destroy();app.exit(0);
  }catch(error){await fs.mkdir(path.join(__dirname,'../.cache'),{recursive:true});await fs.writeFile(path.join(__dirname,'../.cache/visual-check.json'),JSON.stringify({passed:false,error:String(error),checks}));console.error(error);win.destroy();app.exit(1);}
});
