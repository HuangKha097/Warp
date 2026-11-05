import {useCallback,useEffect,useRef} from 'react';
import {advanceSpring,proximityScale,type SpringValue} from './dock-motion';

export interface DockPoint{x:number;y:number;enabled:boolean}
export function useDockMotion(points:DockPoint[]){
  const nodes=useRef<(HTMLDivElement|null)[]>([]);
  const config=useRef(points);config.current=points;
  const wake=useRef<()=>void>(()=>{});
  const pointer=useRef<{x:number;y:number}|null>(null);
  const focused=useRef(-1);
  const reduce=useRef(false);
  useEffect(()=>{
    const query=window.matchMedia('(prefers-reduced-motion: reduce)');
    reduce.current=query.matches;
    let frame=0,last=0,alive=true;
    const springs:SpringValue[]=[];
    function tick(time:number){
      frame=0;if(!alive)return;
      const dt=(time-last)/1000;last=time;
      let moving=false;
      config.current.forEach((point,index)=>{
        const node=nodes.current[index];if(!node)return;
        const p=pointer.current;
        const distance=focused.current===index?0:p?Math.hypot(p.x-point.x,p.y-point.y):Infinity;
        const target=point.enabled&&!reduce.current?proximityScale(distance):1;
        const next=reduce.current?{value:1,velocity:0}:advanceSpring(springs[index]??{value:1,velocity:0},target,dt);
        springs[index]=next;
        node.style.setProperty('--dock-scale',next.value.toFixed(4));
        node.style.setProperty('--dock-lift',`${((next.value-1)*-16).toFixed(2)}px`);
        if(next.value!==target||next.velocity!==0)moving=true;
      });
      if(moving)frame=requestAnimationFrame(tick);
    }
    function start(){if(!frame&&alive){last=performance.now();frame=requestAnimationFrame(tick);}}
    const changed=()=>{reduce.current=query.matches;start();};
    const hidden=()=>{pointer.current=null;focused.current=-1;start();};
    wake.current=start;
    query.addEventListener('change',changed);document.addEventListener('visibilitychange',hidden);
    start();
    return()=>{alive=false;cancelAnimationFrame(frame);wake.current=()=>{};query.removeEventListener('change',changed);document.removeEventListener('visibilitychange',hidden);};
  },[]);
  const move=useCallback((point:{x:number;y:number}|null)=>{pointer.current=point;focused.current=-1;wake.current();},[]);
  const focus=useCallback((index:number)=>{focused.current=index;wake.current();},[]);
  useEffect(()=>{wake.current();},[points]);
  return {nodes,move,focus,reduce};
}
