// Test-only bridge. Not included in the distributed application.
const {contextBridge,ipcRenderer}=require('electron');
let fixture={file:'Project Brief.docx',path:'fixture/Project Brief.docx',targets:['pdf','txt','odt'],busy:false,helperReady:true,anchor:{x:500,y:400},presentation:0,job:null};
const listeners=new Set();
ipcRenderer.on('fixture-state',(_,next)=>{fixture=next;for(const callback of listeners)callback(next);});
contextBridge.exposeInMainWorld('warp',{state:async()=>fixture,onState:callback=>{listeners.add(callback);return()=>listeners.delete(callback);},convert:async format=>{await ipcRenderer.invoke('fixture-convert',format);return fixture;},retry:async()=>{await ipcRenderer.invoke('fixture-action','retry');return fixture;},hide:async()=>ipcRenderer.invoke('fixture-action','hide'),reveal:async()=>ipcRenderer.invoke('fixture-action','reveal')});
