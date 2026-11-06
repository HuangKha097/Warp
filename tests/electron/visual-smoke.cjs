const {app,BrowserWindow,ipcMain}=require('electron');
const path=require('node:path');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const previews=path.join(root,'.cache/visual-smoke/previews');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
app.whenReady().then(async()=>{
  const conversions=[],checks=[],actions=[];
  ipcMain.handle('fixture-convert',(_,format)=>{conversions.push(format);});
  ipcMain.handle('fixture-action',(_,action)=>{actions.push(action);});
  const win=new BrowserWindow({width:1000,height:800,show:false,focusable:false,frame:false,thickFrame:false,hasShadow:false,transparent:true,backgroundColor:'#00000000',webPreferences:{offscreen:true,backgroundThrottling:false,preload:path.join(__dirname,'fixture-preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false}});
  const js=expression=>win.webContents.executeJavaScript(expression);
  const scale=index=>js(`parseFloat(document.querySelectorAll('.dock-magnifier')[${index}].style.getPropertyValue('--dock-scale'))`);
  async function load(overlay){await win.loadFile(path.join(root,'dist/index.html'),{query:overlay?{mode:'overlay'}:{}});await delay(450);}
  async function drag(x,y,from={x:500,y:400}){for(const event of [{type:'mouseDown',...from,button:'left',clickCount:1},{type:'mouseMove',x,y,button:'left'},{type:'mouseUp',x,y,button:'left',clickCount:1}]){win.webContents.sendInputEvent(event);await delay(70);}}
  async function click(selector){
    const point=await js(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`);
    for(const type of ['mouseMove','mouseDown','mouseUp']){win.webContents.sendInputEvent({type,...point,button:'left',clickCount:1});await delay(30);}
  }
  async function snapshot(name,rect){await fs.mkdir(previews,{recursive:true});await fs.writeFile(path.join(previews,name),(await win.webContents.capturePage(rect)).toPNG());}
  async function assertClear(rect){const pixels=(await win.webContents.capturePage(rect)).toBitmap();for(let i=3;i<pixels.length;i+=4)assert.ok(pixels[i]<=2,`hole is covered: alpha ${pixels[i]}`);}
  async function desktopFixture(anchor={x:500,y:400}){await js(`(()=>{const layer=document.createElement('div');layer.id='fixture-desktop';layer.style.cssText='position:fixed;inset:0;background:#151719;pointer-events:none';layer.innerHTML='<div style="position:absolute;left:${anchor.x-20}px;top:${anchor.y-24}px;width:40px;height:48px;background:#eee;border:1px solid #bbb;border-radius:3px;display:grid;place-items:center;color:#343434;font:600 15px Segoe UI">DOC</div><div style="position:absolute;left:${Math.max(4,anchor.x-60)}px;top:${anchor.y+31}px;width:120px;text-align:center;font:11px Segoe UI;color:#eee">Project Brief.docx</div>';document.body.prepend(layer);})()`);}
  try{
    await load(true);
    // Hosted Windows runners often disable UI animations globally. Exercise both
    // preference modes deliberately instead of inheriting the host's setting.
    win.webContents.debugger.attach('1.3');
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
    await delay(50);
    assert.equal(await js('matchMedia("(prefers-reduced-motion: reduce)").matches'),false);
    assert.equal(await js('document.querySelectorAll(".radial-sector").length'),6);
    checks.push('six contiguous annular slices');
    assert.equal(await js('document.querySelectorAll(".radial-core,.radial-file,.core-logo").length'),0);
    assert.equal(await js('document.querySelector(".radial-origin").childElementCount'),0);
    await assertClear({x:465,y:365,width:70,height:70});
    checks.push('center has no duplicated file/icon/text; native drag area stays visually transparent');
    await desktopFixture();
    await delay(100);
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
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    win.webContents.sendInputEvent({type:'mouseMove',x:500,y:239});await delay(200);
    assert.equal(await scale(0),1);checks.push('reduced motion disables magnification');
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
    await js('document.getElementById("fixture-desktop").remove()');
    assert.deepEqual(await js(`(()=>{const s=getComputedStyle(document.querySelector('.orbit-entrance'));return [s.filter,s.maskImage];})()`),['none','none']);
    const edgeFixture={file:'Project Brief.docx',path:'fixture/Project Brief.docx',targets:['pdf','txt','odt'],busy:false,helperReady:true,presentation:1,job:null};
    let lastLayout,lastAnchor;
    for(const [width,height] of [[1000,800],[480,320]]){
      win.setSize(width,height);
      const positions=[['top-left',24,24],['top',width/2,24],['top-right',width-24,24],['left',24,height/2],['right',width-24,height/2],['bottom-left',24,height-24],['bottom',width/2,height-24],['bottom-right',width-24,height-24]];
      for(const [name,x,y] of positions){
        const anchor={x,y};
        win.webContents.send('fixture-state',{...edgeFixture,anchor,presentation:edgeFixture.presentation++,targets:width===480?['pdf','csv','ods']:edgeFixture.targets});await delay(300);
        const layout=await js(`(()=>{const r=document.querySelector('.orbit-entrance').getBoundingClientRect(),h=document.querySelector('.radial-origin').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,outer:r.width/2-5,inner:h.width/2+1,count:document.querySelectorAll('.radial-sector').length,labels:[...document.querySelectorAll('.dock-caption,.dock-status')].filter(n=>n.textContent).map(n=>{const r=n.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom};})};})()`);
        assert.ok(layout.labels.every(r=>r.left>=0&&r.top>=0&&r.right<=width&&r.bottom<=height),`label clipped at ${width}x${height} ${name}`);
        await assertClear({x:x-12,y:y-12,width:24,height:24});
        const frame=await win.webContents.capturePage(),pixels=frame.toBitmap(),size=frame.getSize();
        const alpha=(px,py)=>pixels[(Math.round(py)*size.width+Math.round(px))*4+3];
        for(let py=0;py<size.height;py++)for(let px=0;px<size.width;px++){
          // Include the 1px outer rim and its antialiased edge, but no shadow halo.
          if(Math.hypot(px-layout.x,py-layout.y)>layout.outer+3)assert.ok(alpha(px,py)<=2,`rectangular paint outside ring at ${name}: ${px},${py}`);
        }
        for(let i=0;i<layout.count;i++)for(const fraction of [.2,.55,.9])for(const offset of [-.25,0,.25]){
          const angle=(-90+(i+offset)*360/layout.count)*Math.PI/180,radius=layout.inner+(layout.outer-layout.inner)*fraction;
          assert.ok(alpha(layout.x+Math.cos(angle)*radius,layout.y+Math.sin(angle)*radius)>240,`slice cut out at ${name}`);
        }
        if(width===1000||name==='bottom-right'){
          await desktopFixture(anchor);await delay(60);
          await snapshot(`Warp-${width}-${name}.png`);
          await js('document.getElementById("fixture-desktop").remove()');await delay(30);
        }
        lastLayout=layout;lastAnchor=anchor;
      }
    }
    checks.push('all four corners and edges at normal/small work areas: clear source, intact slices, visible labels and no rectangular shadow pixels');
    await drag(Math.round(lastLayout.x),Math.round(lastLayout.y-(lastLayout.inner+lastLayout.outer)/2),lastAnchor);
    assert.deepEqual(conversions,['pdf','pdf']);checks.push('drag from the original corner-positioned file still converts once');
    win.setSize(370,228);
    await win.loadFile(path.join(root,'dist/index.html'),{query:{mode:'status'}});await delay(250);
    const base={file:null,path:null,targets:[],busy:false,helperReady:true,anchor:{x:0,y:0},presentation:0};
    const job={id:1,input:'fixture/Project Brief.docx',name:'Project Brief.docx',target:'pdf',status:'running',phase:'converting',startedAt:Date.now()-4200,queued:1,completed:0,failures:[]};
    const update=async next=>{win.webContents.send('fixture-state',{...base,job:next});await delay(100);};
    async function assertPopupCorners(){
      for(const [x,y] of [[0,0],[368,0],[0,226],[368,226]])await assertClear({x,y,width:2,height:2});
      assert.deepEqual(await js(`(()=>{const s=getComputedStyle(document.querySelector('.progress-card'));return [s.boxShadow,s.filter];})()`),['none','none']);
    }
    await update(job);
    await assertPopupCorners();
    assert.equal(await js('document.querySelectorAll(".progress-card img").length'),1,'only the brand logo should be an image');
    assert.equal(await js('document.querySelectorAll(".progress-card canvas").length'),0);
    const elapsedBefore=await js('document.querySelector(".progress-footer>span").textContent');
    await delay(1100);
    assert.notEqual(await js('document.querySelector(".progress-footer>span").textContent'),elapsedBefore);
    checks.push('notification is live React DOM with an updating elapsed timer, transparent rounded corners and no shadow');
    assert.equal(await js('document.querySelectorAll("[role=progressbar]").length'),1);
    assert.equal(await js('document.querySelector("[role=progressbar]").hasAttribute("aria-valuenow")'),false);
    await snapshot('Warp-progress-preview.png');checks.push('running progress is visible and indeterminate rather than a fabricated percentage');
    await update({...job,status:'success',output:'fixture/Project Brief.pdf',queued:0,completed:1});
    await assertPopupCorners();
    assert.equal(await js('document.querySelector("[role=progressbar]").getAttribute("aria-valuenow")'),'100');
    await click('.progress-footer button');assert.ok(actions.includes('reveal'));
    await snapshot('Warp-success-preview.png');checks.push('success reveals the converted file folder');
    await update({...job,status:'error',queued:0,error:'Không có quyền ghi bản chuyển đổi vào thư mục này.',failures:[{name:job.name,error:'Không có quyền ghi bản chuyển đổi vào thư mục này.'}]});
    await assertPopupCorners();
    assert.ok(await js('document.querySelector(".progress-error").textContent.includes("quyền")'));
    await click('.progress-footer button');assert.ok(actions.includes('retry'));
    await snapshot('Warp-error-preview.png');checks.push('error reason and retry action are visible');
    await update({...job,id:0,input:'',name:'Không thể mở vòng tròn',target:'',status:'error',queued:0,error:'Vui lòng chọn đúng một file trên Desktop.',failures:[]});
    await assertPopupCorners();
    assert.ok(await js('document.querySelector(".progress-heading").textContent.includes("Không đọc được tệp đang chọn")'));
    assert.equal(await js('document.querySelectorAll(".progress-footer button").length'),0);
    await click('.progress-close');assert.ok(actions.includes('hide'));
    checks.push('selection lookup errors are identified separately from conversion errors');
    assert.ok(await js(`(()=>{const r=document.querySelector('footer').getBoundingClientRect();return r.bottom<=innerHeight&&document.documentElement.scrollWidth<=innerWidth;})()`));
    assert.equal(await js('document.querySelector(".progress-brand img").naturalWidth'),256);checks.push('progress popup fits and uses the updated logo');
    await fs.mkdir(path.join(root,'.cache'),{recursive:true});
    await fs.writeFile(path.join(root,'.cache/visual-check.json'),JSON.stringify({passed:true,conversions,checks},null,2));
    console.log('PASS:',checks.join('; '));win.destroy();app.exit(0);
  }catch(error){await snapshot('Warp-visual-failure.png');await fs.mkdir(path.join(root,'.cache'),{recursive:true});await fs.writeFile(path.join(root,'.cache/visual-check.json'),JSON.stringify({passed:false,error:String(error),checks}));console.error(error);win.destroy();app.exit(1);}
});
