import test from 'node:test';
import assert from 'node:assert/strict';
import { detectMobile, stickVector, lookDelta, TOUCH } from './touchControls.js';

const env = ({ coarse = false, fine = false, points = 0 } = {}) => ({
  matchMedia: (q) => ({ matches: (q === '(pointer: coarse)' && coarse) || (q === '(pointer: fine)' && fine) }),
  navigator: { maxTouchPoints: points },
});
const params = (s) => new URLSearchParams(s);

test('detectMobile: coarse pointer is mobile', () => {
  assert.equal(detectMobile(params(''), env({ coarse: true })), true);
});

test('detectMobile: touch points and no fine pointer is mobile', () => {
  assert.equal(detectMobile(params(''), env({ points: 5 })), true);
});

test('detectMobile: touch laptop with a fine pointer is desktop', () => {
  assert.equal(detectMobile(params(''), env({ points: 10, fine: true })), false);
});

test('detectMobile: plain desktop is desktop', () => {
  assert.equal(detectMobile(params(''), env({ fine: true })), false);
});

test('detectMobile: ?mobile=1 and ?mobile=0 force the mode', () => {
  assert.equal(detectMobile(params('mobile=1'), env({ fine: true })), true);
  assert.equal(detectMobile(params('mobile=0'), env({ coarse: true, points: 5 })), false);
});

test('detectMobile: no matchMedia / navigator is desktop', () => {
  assert.equal(detectMobile(params(''), {}), false);
});

test('stickVector: sizes and limits from the brief', () => {
  assert.equal(TOUCH.baseSize, 120);
  assert.equal(TOUCH.knobSize, 56);
  assert.equal(TOUCH.maxOffset, 60);
  assert.equal(TOUCH.lookDegPerPx, 0.25);
});

test('stickVector: half up = forward at half speed, no sprint', () => {
  const v = stickVector(0, -30);
  assert.equal(v.y, 0.5);
  assert.equal(v.x, 0);
  assert.equal(v.amount, 0.5);
  assert.equal(v.sprint, false);
});

test('stickVector: knob clamps at 60 px and sprints', () => {
  const v = stickVector(300, 0);
  assert.equal(v.knobX, 60);
  assert.equal(v.knobY, 0);
  assert.equal(v.x, 1);
  assert.equal(v.amount, 1);
  assert.equal(v.sprint, true);
});

test('stickVector: sprint only past 90 %', () => {
  assert.equal(stickVector(0, -54).sprint, false); // exactly 90 %
  assert.equal(stickVector(0, -55).sprint, true);
});

test('stickVector: tiny offsets do not move', () => {
  const v = stickVector(2, 2);
  assert.equal(v.amount, 0);
  assert.equal(v.x, 0);
  assert.equal(v.y, 0);
});

test('lookDelta: 0.25 deg per px, drag right turns right, drag up looks up', () => {
  const d = lookDelta(40, -20);
  assert.ok(Math.abs(d.yaw - (-10 * Math.PI) / 180) < 1e-12);
  assert.ok(Math.abs(d.pitch - (5 * Math.PI) / 180) < 1e-12);
});
