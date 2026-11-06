import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('orbit', {
  state:()=>ipcRenderer.invoke('state'),
  retry:()=>ipcRenderer.invoke('retry'),
  convert:(format:string)=>ipcRenderer.invoke('convert',format),
  reveal:()=>ipcRenderer.invoke('reveal'),
  hide:()=>ipcRenderer.invoke('hide'),
  quit:()=>ipcRenderer.invoke('quit'),
  onState:(callback:(value:unknown)=>void)=>{ const listener=(_:unknown,value:unknown)=>callback(value); ipcRenderer.on('state',listener); return ()=>ipcRenderer.removeListener('state',listener); }
});
