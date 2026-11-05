export interface SpringValue { value:number; velocity:number }
// Dock-like cosine falloff, adapted to distance along a circular orbit.
export function proximityScale(distance:number, reach=230, peak=1.24) {
  if(!Number.isFinite(distance)||distance>=reach)return 1;
  const weight=Math.cos(Math.max(0,distance)/reach*Math.PI/2)**2;
  return 1+(peak-1)*weight;
}
export function advanceSpring(state:SpringValue,target:number,elapsed:number):SpringValue {
  let {value,velocity}=state;
  const dt=Math.min(Math.max(elapsed,0),1/30),steps=Math.max(1,Math.ceil(dt*240)),h=dt/steps;
  const stiffness=150/.1,damping=12/.1;
  for(let i=0;i<steps;i++){
    velocity=(velocity+h*stiffness*(target-value))/(1+h*damping+h*h*stiffness);
    value+=velocity*h;
  }
  if(Math.abs(value-target)<.0004&&Math.abs(velocity)<.004)return {value:target,velocity:0};
  return {value,velocity};
}
