export type Anchor={x:number;y:number};
export function ringLayout(anchor:Anchor,width:number,height:number){
  const outer=Math.max(40,Math.min(216,(width-24)/2,(height-24)/2));
  const center={x:Math.max(outer+10,Math.min(anchor.x,width-outer-10)),y:Math.max(outer+10,Math.min(anchor.y,height-outer-10))};
  return {center,outer,inner:outer*.40};
}
export function ringHit(x:number,y:number,center:Anchor,inner:number,outer:number,count:number){
  const dx=x-center.x,dy=y-center.y,r=Math.hypot(dx,dy);
  if(!count||r<inner||r>outer)return -1;
  const step=360/count,angle=(Math.atan2(dy,dx)*180/Math.PI+90+step/2+360)%360;
  const index=Math.floor(angle/step);
  // Match the narrow visible gaps between slices.
  const within=angle-index*step;
  return within<.8||within>step-.8?-1:index;
}
export function ringWedge(start:number,end:number,inner:number,outer:number){
  function point(a:number,r:number){const rad=a*Math.PI/180;return `${Math.cos(rad)*r},${Math.sin(rad)*r}`;}
  return `M${point(start,outer)} A${outer},${outer} 0 ${end-start>180?1:0} 1 ${point(end,outer)} L${point(end,inner)} A${inner},${inner} 0 ${end-start>180?1:0} 0 ${point(start,inner)} Z`;
}
