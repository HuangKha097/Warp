import { contextBridge, ipcRenderer } from 'electron';
import type {AppState,Bridge,SettingsState} from './contracts';
const bridge:Bridge={
  state:()=>ipcRenderer.invoke('state'),
  retry:()=>ipcRenderer.invoke('retry'),
  convert:(format:string)=>ipcRenderer.invoke('convert',format),
  reveal:()=>ipcRenderer.invoke('reveal'),
  hide:()=>ipcRenderer.invoke('hide'),
  settings:()=>ipcRenderer.invoke('settings'),
  updateSettings:patch=>ipcRenderer.invoke('update-settings',patch),
  chooseOutputDirectory:()=>ipcRenderer.invoke('choose-output-directory'),
  finishOnboarding:()=>ipcRenderer.invoke('finish-onboarding'),
  openLicense:()=>ipcRenderer.invoke('open-license'),
  openLocation:location=>ipcRenderer.invoke('open-location',location),
  showCompanion:page=>ipcRenderer.invoke('show-companion',page),
  onSettings:callback=>{const listener=(_:unknown,value:SettingsState)=>callback(value);ipcRenderer.on('settings-changed',listener);return()=>ipcRenderer.removeListener('settings-changed',listener);},
  onState:callback=>{ const listener=(_:unknown,value:AppState)=>callback(value); ipcRenderer.on('state',listener); return ()=>ipcRenderer.removeListener('state',listener); }
};
contextBridge.exposeInMainWorld('warp',bridge);
