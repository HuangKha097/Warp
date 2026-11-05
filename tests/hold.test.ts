import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HoldGesture} from '../electron/hold';
test('release immediately rejects a late selection lookup and conversion',()=>{
  const hold=new HoldGesture();hold.press(1);assert.ok(hold.accepts(1));
  hold.release();assert.equal(hold.active,false);assert.equal(hold.accepts(1),false);
});
test('a lookup from an older hold cannot open the next orbit',()=>{
  const hold=new HoldGesture();hold.press(1);hold.release();hold.press(2);
  assert.equal(hold.accepts(1),false);assert.ok(hold.accepts(2));
});
