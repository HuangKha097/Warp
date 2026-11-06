export type Anchor={x:number;y:number};
export function ringLayout(anchor:Anchor,width:number,height:number){
  const padding=20;
  const preferred=Math.max(1,Math.min(216,(width-padding*2)/2,(height-padding*2)/2));
  const minimum=Math.min(48,preferred);
  for(let outer=preferred;;outer=Math.max(minimum,outer-4)){
    const inner=outer*.4,originRadius=Math.min(44,inner*.75);
    const minX=outer+padding,maxX=width-outer-padding,minY=outer+padding,maxY=height-outer-padding;
    const center={x:Math.max(minX,Math.min(anchor.x,maxX)),y:Math.max(minY,Math.min(anchor.y,maxY))};
    const distance=Math.hypot(center.x-anchor.x,center.y-anchor.y);
    const clearance=outer+originRadius+8;
    // Keep the file inside the central hole or entirely outside the intact ring.
    if(distance+originRadius<=inner-2||distance>=clearance)return {center,outer,inner,originRadius};

    const candidates:Anchor[]=[];
    for(const x of [minX,center.x,maxX]){
      const square=clearance**2-(x-anchor.x)**2;
      if(square>=0)for(const sign of [-1,1])candidates.push({x,y:anchor.y+sign*Math.sqrt(square)});
    }
    for(const y of [minY,center.y,maxY]){
      const square=clearance**2-(y-anchor.y)**2;
      if(square>=0)for(const sign of [-1,1])candidates.push({x:anchor.x+sign*Math.sqrt(square),y});
    }
    for(const x of [minX,maxX])for(const y of [minY,maxY])candidates.push({x,y});
    const fitting=candidates.filter(p=>p.x>=minX-.01&&p.x<=maxX+.01&&p.y>=minY-.01&&p.y<=maxY+.01&&Math.hypot(p.x-anchor.x,p.y-anchor.y)>=clearance-.01);
    fitting.sort((a,b)=>Math.hypot(a.x-center.x,a.y-center.y)-Math.hypot(b.x-center.x,b.y-center.y));
    if(fitting[0])return {center:fitting[0],outer,inner,originRadius};
    if(outer===minimum)return {center,outer,inner,originRadius};
  }
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
