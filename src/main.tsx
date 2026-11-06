import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import RadialMenu from './RadialMenu';
import ProgressCard from './ProgressCard';
import {emptyState,type AppState} from './types';
import './style.css';
import './overlay.css';

function useAppState(){
  const [state,setState]=useState<AppState>(emptyState);
  useEffect(()=>{
    let alive=true;
    window.orbit?.state().then(next=>{if(alive)setState(next);}).catch(()=>{});
    const unsubscribe=window.orbit?.onState(next=>{if(alive)setState(next);});
    return()=>{alive=false;unsubscribe?.();};
  },[]);
  async function convert(format:string){const next=await window.orbit?.convert(format);if(next)setState(next);}
  return {state,convert};
}
function Overlay(){
  const {state:s,convert}=useAppState();
  const [viewport,setViewport]=useState({width:window.innerWidth,height:window.innerHeight});
  useEffect(()=>{const resized=()=>setViewport({width:window.innerWidth,height:window.innerHeight});window.addEventListener('resize',resized);return()=>window.removeEventListener('resize',resized);},[]);
  return <div className="hold-layer"><RadialMenu file={s.file} targets={s.targets} busy={s.busy} width={viewport.width} height={viewport.height} anchor={s.anchor??{x:260,y:260}} presentation={s.presentation} onConvert={convert}/></div>;
}
function Status(){
  const {state}=useAppState();
  return <ProgressCard job={state.job??null} onHide={()=>void window.orbit?.hide()} onReveal={()=>void window.orbit?.reveal()} onRetry={()=>void window.orbit?.retry()}/>;
}
const statusMode=new URLSearchParams(window.location.search).get('mode')==='status';
document.body.classList.toggle('status-mode',statusMode);
document.body.classList.toggle('overlay-mode',!statusMode);
createRoot(document.getElementById('root')!).render(statusMode?<Status/>:<Overlay/>);
