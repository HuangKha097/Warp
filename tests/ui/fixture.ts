import type {AppState,Bridge,SettingsState} from '../../shared/contracts';
const mode=new URLSearchParams(location.search).get('mode');
const state:AppState={file:'tài liệu.txt',path:'C:\\Documents\\tài liệu.txt',targets:['pdf','docx','odt'],busy:false,helperReady:true,anchor:{x:500,y:400},presentation:1,job:null,language:'vi'};
const settings:SettingsState={preferences:{language:'vi',launchAtLogin:true,outputMode:'source',outputDirectory:null,onboardingCompleted:false},version:'0.6.0',installDirectory:'C:\\Warp',settingsFile:'C:\\Users\\test\\AppData\\Roaming\\Warp\\settings.json',packaged:true};
const calls:{name:string;value?:unknown}[]=[];
const stateListeners=new Set<(s:AppState)=>void>(),settingsListeners=new Set<(s:SettingsState)=>void>();
if(mode==='status')state.job={id:1,input:state.path!,name:state.file!,target:'pdf',status:'running',phase:'converting',startedAt:Date.now()-2000,queued:1,completed:0,failures:[]};
const bridge:Bridge={
  state:async()=>structuredClone(state),settings:async()=>structuredClone(settings),
  convert:async format=>{calls.push({name:'convert',value:format});return state;},
  retry:async()=>{calls.push({name:'retry'});return state;},
  reveal:async()=>{calls.push({name:'reveal'});},hide:async()=>{calls.push({name:'hide'});},
  updateSettings:async patch=>{Object.assign(settings.preferences,patch);state.language=settings.preferences.language;settingsListeners.forEach(fn=>fn(structuredClone(settings)));stateListeners.forEach(fn=>fn(structuredClone(state)));return {ok:true,value:structuredClone(settings)};},
  chooseOutputDirectory:async()=>{settings.preferences.outputMode='custom';settings.preferences.outputDirectory='C:\\Converted';settingsListeners.forEach(fn=>fn(structuredClone(settings)));return {ok:true,value:structuredClone(settings)};},
  finishOnboarding:async()=>{calls.push({name:'finish'});},openLicense:async()=>{},openLocation:async()=>{},showCompanion:async page=>{calls.push({name:'page',value:page});},
  onState:fn=>{stateListeners.add(fn);return()=>stateListeners.delete(fn);},
  onSettings:fn=>{settingsListeners.add(fn);return()=>settingsListeners.delete(fn);}
};
Object.assign(window,{warp:bridge,__warpTest:{calls,state,settings,update:(patch:Partial<AppState>)=>{Object.assign(state,patch);stateListeners.forEach(fn=>fn(structuredClone(state)));}}});
await import('../../src/main');
