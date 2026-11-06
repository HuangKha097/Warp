import { contextBridge, ipcRenderer } from 'electron';
import type {AppState,Bridge} from './contracts';
const bridge:Bridge={
  state:()=>ipcRenderer.invoke('state'),
  retry:()=>ipcRenderer.invoke('retry'),
  convert:(format:string)=>ipcRenderer.invoke('convert',format),
  reveal:()=>ipcRenderer.invoke('reveal'),
  hide:()=>ipcRenderer.invoke('hide'),
  onState:callback=>{ const listener=(_:unknown,value:AppState)=>callback(value); ipcRenderer.on('state',listener); return ()=>ipcRenderer.removeListener('state',listener); }
};
contextBridge.exposeInMainWorld('warp',bridge);
