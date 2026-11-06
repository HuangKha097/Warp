import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ringLayout,ringHit} from '../src/ring-layout';
test('ring stays centered on the selected icon when there is room',()=>{
  assert.deepEqual(ringLayout({x:500,y:400},1000,800).center,{x:500,y:400});
});
test('whole circle stays visible near screen edges',()=>{
  for(const anchor of [{x:36,y:36},{x:36,y:400},{x:970,y:770}]){
    const {center,outer}=ringLayout(anchor,1000,800);
    assert.ok(center.x-outer>=0&&center.x+outer<=1000);assert.ok(center.y-outer>=0&&center.y+outer<=800);
  }
});

test('edge and corner layouts preserve the source without punching holes in slices',()=>{
  for(const [width,height] of [[1000,800],[800,560],[480,320],[1920,1040]]){
    for(const x of [24,100,width/2,width-100,width-24])for(const y of [24,100,height/2,height-100,height-24]){
      const anchor={x,y},{center,outer,inner,originRadius}=ringLayout(anchor,width,height);
      assert.ok(center.x-outer>=19.9&&center.x+outer<=width-19.9);
      assert.ok(center.y-outer>=19.9&&center.y+outer<=height-19.9);
      const distance=Math.hypot(center.x-x,center.y-y);
      assert.ok(distance+originRadius<=inner-1.9||distance>=outer+originRadius+7.9,`source covered at ${width}x${height}, ${x},${y}`);
    }
  }
});
test('every slice accepts drops throughout its annular area, not only on its icon',()=>{
  const center={x:400,y:400},inner=80,outer=210,count=5;
  for(let i=0;i<count;i++)for(const offset of [-20,0,20]){
    const a=(-90+i*72+offset)*Math.PI/180;
    assert.equal(ringHit(center.x+Math.cos(a)*190,center.y+Math.sin(a)*190,center,inner,outer,count),i);
  }
  assert.equal(ringHit(400,400,center,inner,outer,count),-1);
  assert.equal(ringHit(700,400,center,inner,outer,count),-1);
});
