// Test-only bridge. Not included in the distributed application.
const {contextBridge,ipcRenderer}=require('electron');
const fixture={file:'Project Brief.docx',path:'fixture/Project Brief.docx',targets:['pdf','txt','odt'],busy:false,result:null,office:true,helperReady:true,message:'Kéo sang định dạng bạn muốn.',anchor:{x:500,y:400}};
contextBridge.exposeInMainWorld('orbit',{state:async()=>fixture,onState:()=>()=>{},convert:async format=>{await ipcRenderer.invoke('fixture-convert',format);return fixture;},hide:async()=>{},reveal:async()=>{},choose:async()=>fixture,accept:async()=>fixture});
