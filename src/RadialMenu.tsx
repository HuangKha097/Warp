import {useEffect,useId,useRef,useState,type PointerEvent,type CSSProperties} from 'react';
import {ringLayout,ringHit,ringWedge,type Anchor} from './ring-layout';
import {useDockMotion} from './use-dock-motion';
import type {Language} from '../shared/contracts';
import './radial-menu.css';

const primary=['pdf','docx','xlsx','pptx','txt'];
const names:Record<string,string>={pdf:'PDF',txt:'Văn bản',docx:'Word',xlsx:'Excel',csv:'CSV',pptx:'PowerPoint',odt:'ODT',ods:'ODS',odp:'ODP'};
function DocumentGlyph({format='DOC'}:{format?:string}){
  return <svg className="document-glyph" viewBox="0 0 36 44" fill="none" aria-hidden="true"><path d="M7 2h15l9 9v29a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.4"/><path d="M22 2v9h9M11 17h13M11 21h10" stroke="currentColor" strokeWidth="1.3" opacity=".5"/><text x="18" y="34" textAnchor="middle" fill="currentColor" fontSize="8" fontWeight="650">{format.toUpperCase().slice(0,4)}</text></svg>;
}
interface Props {file:string|null;targets:string[];busy:boolean;anchor:Anchor;width:number;height:number;presentation?:number;language?:Language;onConvert:(format:string)=>Promise<unknown>}
export default function RadialMenu({file,targets,busy,anchor,width,height,presentation=0,language='vi',onConvert}:Props){
  const en=language==='en';
  const labels:Record<string,string>={...names,txt:en?'Text':'Văn bản'};
  const [active,setActive]=useState<string|null>(null);
  const root=useRef<HTMLDivElement>(null),entrance=useRef<HTMLDivElement>(null),ghost=useRef<HTMLDivElement>(null);
  const dragging=useRef(false),committing=useRef(false);
  const {center,inner,outer,originRadius}=ringLayout(anchor,width,height);
  const visualScale=outer/216;
  const formats=[...new Set([...primary,...targets])],step=360/formats.length;
  const radius=(inner+outer)/2;
  const points=formats.map((format,i)=>{const a=(-90+i*step)*Math.PI/180;return {x:center.x+Math.cos(a)*radius,y:center.y+Math.sin(a)*radius-10*visualScale,enabled:!!file&&targets.includes(format)&&!busy};});
  const motion=useDockMotion(points);
  const id=useId().replace(/:/g,'');

  function reset(){dragging.current=false;setActive(null);motion.move(null);if(ghost.current)ghost.current.hidden=true;}
  useEffect(()=>{
    const stop=()=>{dragging.current=false;setActive(null);motion.move(null);if(ghost.current)ghost.current.hidden=true;};
    window.addEventListener('blur',stop);document.addEventListener('visibilitychange',stop);
    return()=>{window.removeEventListener('blur',stop);document.removeEventListener('visibilitychange',stop);};
  },[motion.move]);
  useEffect(()=>{
    dragging.current=false;setActive(null);motion.move(null);if(ghost.current)ghost.current.hidden=true;
    if(!entrance.current)return;
    const animation=entrance.current.animate(motion.reduce.current?[{opacity:0},{opacity:1}]:[{opacity:0,transform:'scale(.94)'},{opacity:1,transform:'scale(1)'}],{duration:motion.reduce.current?80:240,easing:'cubic-bezier(.2,1.18,.4,1)'});
    return()=>animation.cancel();
  },[file,presentation,motion.move,motion.reduce]);
  function local(e:PointerEvent){const rect=root.current!.getBoundingClientRect();return {x:e.clientX-rect.left,y:e.clientY-rect.top};}
  function hit(p:Anchor){const index=ringHit(p.x,p.y,center,inner,outer,formats.length);const format=formats[index];return file&&targets.includes(format)&&!busy?format:null;}
  async function choose(format:string){
    if(!file||busy||committing.current||!targets.includes(format))return;
    committing.current=true;
    const index=formats.indexOf(format),face=motion.nodes.current[index]?.querySelector('.dock-face');
    if(face&&!motion.reduce.current)face.animate([{transform:'translateY(0)'},{transform:'translateY(-7px)',offset:.4},{transform:'translateY(0)'}],{duration:280,easing:'cubic-bezier(.2,.7,.3,1)'});
    try{await onConvert(format);}finally{committing.current=false;}
  }
  function move(e:PointerEvent){const p=local(e);motion.move(p);setActive(hit(p));if(dragging.current&&ghost.current){ghost.current.style.left=`${p.x}px`;ghost.current.style.top=`${p.y}px`;}}
  function begin(e:PointerEvent){
    if(!file||busy||!targets.length)return;
    e.preventDefault();dragging.current=true;root.current?.setPointerCapture(e.pointerId);
    const p=local(e);motion.move(p);
    if(ghost.current){ghost.current.hidden=false;ghost.current.style.left=`${p.x}px`;ghost.current.style.top=`${p.y}px`;}
  }
  function release(e:PointerEvent){if(!dragging.current)return;const format=hit(local(e));reset();if(format)void choose(format);}
  const shifted=Math.hypot(center.x-anchor.x,center.y-anchor.y)>2;
  const bounds={left:center.x-outer-5,top:center.y-outer-5,width:(outer+5)*2,height:(outer+5)*2};
  return <div className={`radial-menu ${busy?'is-busy':''}`} ref={root} style={{width,height}} onPointerMove={move} onPointerUp={release} onPointerCancel={reset} onPointerLeave={()=>{if(!dragging.current){setActive(null);motion.move(null);}}} aria-label={en?'Conversion circle':'Vòng tròn chuyển đổi'}>
    <div ref={entrance} className="orbit-entrance" style={{...bounds,'--ring-scale':visualScale} as CSSProperties}>
      <svg className="radial-orbit" width="100%" height="100%" viewBox={`${-outer-5} ${-outer-5} ${(outer+5)*2} ${(outer+5)*2}`}>
        <defs><linearGradient id={`${id}-surface`} x2="0" y2="1"><stop stopColor="#2b2b2c"/><stop offset="1" stopColor="#202021"/></linearGradient></defs>
        <circle r={outer+1} className="radial-rim"/>
        {formats.map((format,i)=>{const enabled=!!file&&targets.includes(format)&&!busy,angle=-90+i*step;return <g key={format} className={`radial-sector ${active===format?'is-active':''} ${enabled?'':'is-disabled'}`} data-format={format} role="button" tabIndex={enabled?0:-1} aria-disabled={!enabled} aria-label={`${labels[format]}${enabled?'':en?' — unavailable for this file':' — không áp dụng cho tệp này'}`} onFocus={()=>{setActive(format);motion.focus(i);}} onBlur={()=>{setActive(null);motion.focus(-1);}} onKeyDown={e=>{if(enabled&&(e.key==='Enter'||e.key===' ')){e.preventDefault();void choose(format);}}} onClick={()=>void choose(format)}>
          <path fill={`url(#${id}-surface)`} d={ringWedge(angle-step/2+.65,angle+step/2-.65,inner,outer)}/>
        </g>;})}
      </svg>
      {formats.map((format,i)=>{const p=points[i];return <div key={format} className={`dock-slot ${active===format?'is-active':''} ${p.enabled?'':'is-disabled'}`} style={{left:p.x-bounds.left,top:p.y-bounds.top}} aria-hidden="true">
        <div className="dock-magnifier" ref={node=>{motion.nodes.current[i]=node;}}><div className="dock-face"><DocumentGlyph format={format}/></div></div>
        <span className="dock-caption">{labels[format]}</span><span className="dock-status">{active===format?(en?'Release to convert':'Thả để chuyển đổi'):!p.enabled&&file?(en?'Unavailable':'Không áp dụng'):''}</span>
      </div>;})}
    </div>
    <button className="radial-origin" style={{left:center.x,top:center.y,width:inner*2-2,height:inner*2-2}} aria-label={file?(en?`Drag ${file} to a format`:`Kéo ${file} sang định dạng`):(en?'Original file area':'Vùng tệp gốc')} disabled={busy||!file} onPointerDown={begin}/>
    {shifted&&<button className="radial-origin" style={{left:anchor.x,top:anchor.y,width:originRadius*2,height:originRadius*2}} aria-label={en?'Drag from the selected original file':'Kéo từ tệp gốc đã chọn'} disabled={busy||!file} onPointerDown={begin}/>}
    <div className="file-ghost" ref={ghost} hidden aria-hidden="true"><DocumentGlyph format={file?.split('.').pop()}/></div>
  </div>;
}
