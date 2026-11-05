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
test('every slice accepts drops throughout its annular area, not only on its icon',()=>{
  const center={x:400,y:400},inner=80,outer=210,count=5;
  for(let i=0;i<count;i++)for(const offset of [-20,0,20]){
    const a=(-90+i*72+offset)*Math.PI/180;
    assert.equal(ringHit(center.x+Math.cos(a)*190,center.y+Math.sin(a)*190,center,inner,outer,count),i);
  }
  assert.equal(ringHit(400,400,center,inner,outer,count),-1);
  assert.equal(ringHit(700,400,center,inner,outer,count),-1);
});
