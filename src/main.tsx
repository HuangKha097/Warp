import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import RadialMenu from './RadialMenu';
import {emptyState,type AppState} from './types';
import logo from '../assets/warp.png';
import './style.css';
import './overlay.css';

function useAppState(){
  const [state,setState]=useState<AppState>(emptyState);
  const [error,setError]=useState('');
  useEffect(()=>{
    let alive=true;
    window.orbit?.state().then(next=>{if(alive)setState(next);}).catch(e=>{if(alive)setError(String(e));});
    const unsubscribe=window.orbit?.onState(next=>{if(alive)setState(next);});
    return()=>{alive=false;unsubscribe?.();};
  },[]);
  async function convert(format:string){
    setError('');
    try{const next=await window.orbit?.convert(format);if(next)setState(next);}
    catch(e){setError(String(e));}
  }
  async function pick(){
    setError('');
    try{const next=await window.orbit?.choose();if(next)setState(next);}
    catch(e){setError(String(e));}
  }
  return {state,setState,error,setError,convert,pick};
}
function App(){
  const {state:s,setState,error,setError,convert,pick}=useAppState();
  const stage=useRef<HTMLDivElement>(null);
  const [size,setSize]=useState(440);
  useEffect(()=>{
    const node=stage.current;if(!node)return;
    const observer=new ResizeObserver(entries=>{const width=Math.round(entries[0].contentRect.width);setSize(Math.min(440,width));});
    observer.observe(node);return()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')void window.orbit?.hide();};
    window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);
  },[]);
  return <main className="panel" onDragOver={e=>e.preventDefault()} onDrop={async e=>{
    e.preventDefault();if(s.busy)return;
    if(e.dataTransfer.files.length!==1){setError('Vui lòng thả đúng một tệp.');return;}
    try{const next=await window.orbit?.accept(e.dataTransfer.files[0]);if(next){setState(next);setError('');}}
    catch(e){setError(String(e));}
  }}>
    <header className="app-header"><div className="brand"><img src={logo} alt=""/><div><strong>Warp</strong><span>Chuyển định dạng. Giữ nguyên bản gốc.</span></div></div><button className="close" aria-label="Ẩn Warp" title="Ẩn xuống khay hệ thống" onClick={()=>void window.orbit?.hide()}>×</button></header>
    <div className="shortcut-row"><span className="connection"><i/>{s.helperReady?'Sẵn sàng':window.orbit?'Đang khởi động…':'Xem trước'}</span><span className="shortcut"><span>Giữ</span><kbd>Alt</kbd><span>+</span><kbd>Shift</kbd></span></div>
    <div className="companion-stage" ref={stage}>
      <RadialMenu file={s.file} targets={s.targets} busy={s.busy} width={size} height={size} anchor={{x:size/2,y:size/2}} presentation={s.presentation} onConvert={convert} onPick={()=>void pick()}/>
    </div>
    <div className="feedback" aria-live="polite"><p className={error?'error':''}>{error||s.message}</p>{s.result?<button className="result" onClick={()=>void window.orbit?.reveal()}><span>✓ {s.result}</span><span>Hiện trong thư mục ↗</span></button>:<span className="assurance">{s.office?'Xử lý trên máy · Tạo bản sao mới':'Đang kiểm tra bộ chuyển đổi tích hợp…'}</span>}</div>
    <footer><button className="choose" disabled={s.busy} onClick={()=>void pick()}><span>＋</span> Chọn tệp{s.file?' khác':''}</button><span>Esc để ẩn</span></footer>
  </main>;
}
function Overlay(){
  const {state:s,convert}=useAppState();
  const [viewport,setViewport]=useState({width:window.innerWidth,height:window.innerHeight});
  useEffect(()=>{const resized=()=>setViewport({width:window.innerWidth,height:window.innerHeight});window.addEventListener('resize',resized);return()=>window.removeEventListener('resize',resized);},[]);
  return <div className="hold-layer"><RadialMenu file={s.file} targets={s.targets} busy={s.busy} width={viewport.width} height={viewport.height} anchor={s.anchor??{x:260,y:260}} presentation={s.presentation} onConvert={convert}/></div>;
}
const overlayMode=new URLSearchParams(window.location.search).get('mode')==='overlay';
document.body.classList.toggle('overlay-mode',overlayMode);
createRoot(document.getElementById('root')!).render(overlayMode?<Overlay/>:<App/>);
