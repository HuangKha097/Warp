import {lazy,Suspense,useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import RadialMenu from './RadialMenu';
import ProgressCard from './ProgressCard';
import {emptyState,type AppState} from './types';
import './style.css';
import {installBridge,notifyReady} from './bridge';
installBridge();
const Companion=lazy(()=>import('./Companion'));

function Ready(){useEffect(notifyReady,[]);return null;}

function useAppState(){
  const [state,setState]=useState<AppState>(emptyState);
  useEffect(()=>{document.documentElement.lang=state.language??'vi';},[state.language]);
  useEffect(()=>{
    let alive=true;
    window.warp?.state().then(next=>{if(alive)setState(next);}).catch(()=>{});
    const unsubscribe=window.warp?.onState(next=>{if(alive)setState(next);});
    return()=>{alive=false;unsubscribe?.();};
  },[]);
  async function convert(format:string){const next=await window.warp?.convert(format);if(next)setState(next);}
  return {state,convert};
}
function Overlay(){
  const {state:s,convert}=useAppState();
  const [viewport,setViewport]=useState({width:window.innerWidth,height:window.innerHeight});
  useEffect(()=>{const resized=()=>setViewport({width:window.innerWidth,height:window.innerHeight});window.addEventListener('resize',resized);return()=>window.removeEventListener('resize',resized);},[]);
  return <div className="hold-layer"><RadialMenu file={s.file} targets={s.targets} busy={s.busy} width={viewport.width} height={viewport.height} anchor={s.anchor} presentation={s.presentation} language={s.language} onConvert={convert}/></div>;
}
function Status(){
  const {state}=useAppState();
  return <ProgressCard job={state.job} language={state.language} onHide={()=>void window.warp?.hide()} onReveal={()=>void window.warp?.reveal()} onRetry={()=>void window.warp?.retry()}/>;
}
const mode=new URLSearchParams(window.location.search).get('mode');
const companionMode=mode==='settings'||mode==='onboarding';
document.body.classList.toggle('status-mode',mode==='status');
document.body.classList.toggle('overlay-mode',!companionMode&&mode!=='status');
document.body.classList.toggle('companion-mode',companionMode);
createRoot(document.getElementById('root')!).render(<>{companionMode?<Suspense fallback={null}><Companion mode={mode}/><Ready/></Suspense>:<><Ready/>{mode==='status'?<Status/>:<Overlay/>}</>}</>);
