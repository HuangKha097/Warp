const {app,BrowserWindow,ipcMain}=require('electron');
const path=require('node:path');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
app.whenReady().then(async()=>{
  const conversions=[],checks=[],actions=[];
  ipcMain.handle('fixture-convert',(_,format)=>{conversions.push(format);});
  ipcMain.handle('fixture-action',(_,action)=>{actions.push(action);});
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
    win.setSize(370,228);
    await win.loadFile(path.join(__dirname,'../dist/index.html'),{query:{mode:'status'}});await delay(250);
    const base={file:null,path:null,targets:[],busy:false,result:null,office:true,helperReady:true,message:'',presentation:0};
    const job={id:1,input:'fixture/Project Brief.docx',name:'Project Brief.docx',target:'pdf',status:'running',phase:'converting',startedAt:Date.now()-4200,queued:1,completed:0,failures:[]};
    const update=async next=>{win.webContents.send('fixture-state',{...base,job:next});await delay(100);};
    await update(job);
    assert.equal(await js('document.querySelectorAll("[role=progressbar]").length'),1);
    assert.equal(await js('document.querySelector("[role=progressbar]").hasAttribute("aria-valuenow")'),false);
    await snapshot('Warp-progress-preview.png');checks.push('running progress is visible and indeterminate rather than a fabricated percentage');
    await update({...job,status:'success',output:'fixture/Project Brief.pdf',queued:0,completed:1});
    assert.equal(await js('document.querySelector("[role=progressbar]").getAttribute("aria-valuenow")'),'100');
    await js('document.querySelector(".progress-footer button").click()');await delay(30);assert.ok(actions.includes('reveal'));
    await snapshot('Warp-success-preview.png');checks.push('success reveals the converted file folder');
    await update({...job,status:'error',queued:0,error:'Không có quyền ghi bản chuyển đổi vào thư mục này.',failures:[{name:job.name,error:'Không có quyền ghi bản chuyển đổi vào thư mục này.'}]});
    assert.ok(await js('document.querySelector(".progress-error").textContent.includes("quyền")'));
    await js('document.querySelector(".progress-footer button").click()');await delay(30);assert.ok(actions.includes('retry'));
    await snapshot('Warp-error-preview.png');checks.push('error reason and retry action are visible');
    assert.ok(await js(`(()=>{const r=document.querySelector('footer').getBoundingClientRect();return r.bottom<=innerHeight&&document.documentElement.scrollWidth<=innerWidth;})()`));
    assert.equal(await js('document.querySelector(".progress-brand img").naturalWidth'),256);checks.push('progress popup fits and uses the updated logo');
    await fs.mkdir(path.join(__dirname,'../.cache'),{recursive:true});
    await fs.writeFile(path.join(__dirname,'../.cache/visual-check.json'),JSON.stringify({passed:true,conversions,checks},null,2));
    console.log('PASS:',checks.join('; '));win.destroy();app.exit(0);
  }catch(error){await fs.mkdir(path.join(__dirname,'../.cache'),{recursive:true});await fs.writeFile(path.join(__dirname,'../.cache/visual-check.json'),JSON.stringify({passed:false,error:String(error),checks}));console.error(error);win.destroy();app.exit(1);}
});
