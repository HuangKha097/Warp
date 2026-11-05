import {test} from 'node:test';
import assert from 'node:assert/strict';
import {advanceSpring,proximityScale} from '../src/dock-motion';
test('magnification falls off smoothly and returns to rest outside the reach',()=>{
  assert.equal(proximityScale(0),1.24);
  assert.ok(proximityScale(30)>proximityScale(80));
  assert.ok(proximityScale(80)>proximityScale(130));
  assert.equal(proximityScale(230),1);assert.equal(proximityScale(Infinity),1);
});
test('spring settles after hovering and leaving without overshooting or drifting',()=>{
  let state={value:1,velocity:0};
  for(let i=0;i<180;i++)state=advanceSpring(state,1.24,1/60);
  assert.equal(state.value,1.24);assert.equal(state.velocity,0);
  for(let i=0;i<180;i++)state=advanceSpring(state,1,1/60);
  assert.equal(state.value,1);assert.equal(state.velocity,0);
});
test('a suspended window cannot produce an unstable spring on resume',()=>{
  const next=advanceSpring({value:1,velocity:0},1.24,3600);
  assert.ok(Number.isFinite(next.value)&&next.value>=1&&next.value<1.24);
});
