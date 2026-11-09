import test from 'node:test';
import assert from 'node:assert/strict';
import { zombieCountForWave, zombieSpeedForWave, hitsToKill, tryJump, stepJump } from './rules.js';
import { WEAPONS, ZOMBIE, JUMP } from './config.js';
import { WeaponState } from './weaponState.js';

const byId = (id) => WEAPONS.find((w) => w.id === id);

test('wave N spawns 5 + 3N zombies', () => {
  assert.equal(zombieCountForWave(1), 8);
  assert.equal(zombieCountForWave(2), 11);
  assert.equal(zombieCountForWave(10), 35);
});

test('zombie speed is 2.0, +0.15 per wave, max 4', () => {
  assert.equal(zombieSpeedForWave(1), 2.0);
  assert.ok(Math.abs(zombieSpeedForWave(2) - 2.15) < 1e-9);
  assert.equal(zombieSpeedForWave(100), 4);
});

test('hits to kill: rifle 7, pistol 3, knife 2', () => {
  assert.equal(hitsToKill(byId('rifle').damage, ZOMBIE.hp), 7);
  assert.equal(hitsToKill(byId('pistol').damage, ZOMBIE.hp), 3);
  assert.equal(hitsToKill(byId('knife').damage, ZOMBIE.hp), 2);
});

function simulate(ws, seconds, input, frameMs = 1000 / 60) {
  const shots = [];
  // Frame time stamps in integer ms, the same as the game clock (Game.update rounds game time).
  const frames = Math.round((seconds * 1000) / frameMs);
  for (let i = 0; i < frames; i++) {
    const t = Math.round(i * frameMs);
    ws.update(t);
    if (ws.tryFire(t, typeof input === 'function' ? input(t) : input)) shots.push(t);
  }
  return shots;
}

test('rifle: held trigger fires 10 shots per second, mag 30, then reloads in 2000 ms', () => {
  const ws = new WeaponState(byId('rifle'));
  const shots = simulate(ws, 1, { held: true, pressedAt: 0 });
  assert.equal(shots.length, 10);
  const ws2 = new WeaponState(byId('rifle'));
  const all = simulate(ws2, 3.05, { held: true, pressedAt: 0 });
  assert.equal(all.length, 30);
  assert.ok(all[29] - all[0] > 2880 && all[29] - all[0] < 2920);
  assert.equal(ws2.mag <= 30, true);
});

test('rifle reload takes 2000 ms', () => {
  const ws = new WeaponState(byId('rifle'));
  ws.mag = 3;
  assert.ok(ws.startReload(1000));
  ws.update(2999);
  assert.equal(ws.mag, 3);
  ws.update(3000);
  assert.equal(ws.mag, 30);
});

test('pistol: one shot per click, max 4 shots per second, mag 12, reload 1200 ms', () => {
  const ws = new WeaponState(byId('pistol'));
  const held = simulate(ws, 1, { held: true, pressedAt: 0 });
  assert.equal(held.length, 1);
  const ws2 = new WeaponState(byId('pistol'));
  const spam = simulate(ws2, 1, (t) => ({ held: true, pressedAt: t }));
  assert.equal(spam.length, 4);
  assert.equal(byId('pistol').mag, 12);
  const ws3 = new WeaponState(byId('pistol'));
  ws3.mag = 0;
  ws3.update(0);
  assert.ok(ws3.reloading);
  ws3.update(1199);
  assert.equal(ws3.mag, 0);
  ws3.update(1200);
  assert.equal(ws3.mag, 12);
});

test('knife: 500 ms between swings, no ammo, R does nothing', () => {
  const ws = new WeaponState(byId('knife'));
  const swings = simulate(ws, 1, { held: true, pressedAt: 0 });
  assert.equal(swings.length, 2);
  assert.equal(ws.mag, Infinity);
  assert.equal(ws.startReload(0), false);
});

test('a shot after a pause waits a full interval (no early second shot)', () => {
  const ws = new WeaponState(byId('pistol'));
  assert.ok(ws.tryFire(0, { held: false, pressedAt: 0 }));
  assert.ok(ws.tryFire(400, { held: false, pressedAt: 400 }));
  assert.equal(ws.tryFire(500, { held: false, pressedAt: 500 }), false);
  assert.ok(ws.tryFire(650, { held: false, pressedAt: 650 }));
  const knife = new WeaponState(byId('knife'));
  assert.ok(knife.tryFire(33, { held: true, pressedAt: 33 }));
  assert.equal(knife.tryFire(500, { held: true, pressedAt: 33 }), false);
  assert.ok(knife.tryFire(533, { held: true, pressedAt: 33 }));
});

// Steps the weapon with uneven frame times (cycled) and returns the shot times.
function simulateSteps(ws, durationMs, steps, input) {
  const shots = [];
  let t = 0;
  for (let i = 0; t < durationMs; i++) {
    ws.update(t);
    if (ws.tryFire(t, typeof input === 'function' ? input(t) : input)) shots.push(t);
    t += steps[i % steps.length];
  }
  return shots;
}

function minGap(shots) {
  let min = Infinity;
  for (let i = 1; i < shots.length; i++) min = Math.min(min, shots[i] - shots[i - 1]);
  return min;
}

const UNEVEN_STEPS = [
  [16, 33, 7, 120],
  [7, 7, 7, 120, 16],
  [33, 16, 7, 7, 7, 120, 7],
  [120, 7, 16, 33],
  [7, 33, 7, 33, 16, 16, 120, 7],
];

for (const steps of UNEVEN_STEPS) {
  const label = steps.join('/');

  test(`rifle held fire, frames ${label} ms: every gap >= 100 ms`, () => {
    const ws = new WeaponState(byId('rifle'));
    const shots = simulateSteps(ws, 6000, steps, { held: true, pressedAt: 0 });
    assert.ok(shots.length >= 30, `shots=${shots.length}`);
    const gap = minGap(shots);
    assert.ok(gap >= 100, `min gap ${gap} ms, shots ${shots.join(',')}`);
  });

  test(`pistol clicked every frame, frames ${label} ms: every gap >= 250 ms`, () => {
    const ws = new WeaponState(byId('pistol'));
    const shots = simulateSteps(ws, 6000, steps, (t) => ({ held: true, pressedAt: t }));
    assert.ok(shots.length >= 12, `shots=${shots.length}`);
    const gap = minGap(shots);
    assert.ok(gap >= 250, `min gap ${gap} ms, shots ${shots.join(',')}`);
  });

  test(`pistol held fire, frames ${label} ms: one shot, every gap >= 250 ms`, () => {
    const ws = new WeaponState(byId('pistol'));
    const shots = simulateSteps(ws, 3000, steps, { held: true, pressedAt: 0 });
    assert.equal(shots.length, 1);
    assert.ok(minGap(shots) >= 250);
  });

  test(`knife held attack, frames ${label} ms: every gap >= 500 ms`, () => {
    const ws = new WeaponState(byId('knife'));
    const shots = simulateSteps(ws, 6000, steps, { held: true, pressedAt: 0 });
    assert.ok(shots.length >= 8, `swings=${shots.length}`);
    const gap = minGap(shots);
    assert.ok(gap >= 500, `min gap ${gap} ms, swings ${shots.join(',')}`);
  });
}

test('pistol: a late shot at 280 ms does not allow a second shot at 500 ms', () => {
  const ws = new WeaponState(byId('pistol'));
  assert.ok(ws.tryFire(0, { held: true, pressedAt: 0 }));
  assert.ok(ws.tryFire(280, { held: true, pressedAt: 280 }));
  assert.equal(ws.tryFire(500, { held: true, pressedAt: 500 }), false);
  assert.ok(ws.tryFire(530, { held: true, pressedAt: 530 }));
});

// Fractional boundary: a request 0.0005 ms before the full interval is refused,
// a request at exactly the interval is allowed. No tolerance below the interval.
// "last" is the actual time of the last shot. In the late cases the last shot came
// lateBy ms after the weapon was ready, so a schedule that counts from the planned
// time instead of the actual shot allows the early request.
for (const [id, interval] of [['rifle', 100], ['pistol', 250], ['knife', 500]]) {
  test(`${id}: request at ${interval - 0.0005} ms after the last shot is refused, at ${interval} ms is allowed`, () => {
    const cases = [];
    for (const start of [0, 1000, 123456]) {
      cases.push({ start, lateBy: null });
      for (const lateBy of [1, 20, 33, 30.5]) cases.push({ start, lateBy });
    }
    for (const { start, lateBy } of cases) {
      const ws = new WeaponState(byId(id));
      assert.ok(ws.tryFire(start, { held: true, pressedAt: start }), 'first shot');
      let last = start;
      if (lateBy !== null) {
        last = start + interval + lateBy;
        assert.ok(ws.tryFire(last, { held: true, pressedAt: last }), `late shot ${lateBy} ms after ready`);
      }
      const early = last + interval - 0.0005;
      assert.equal(ws.tryFire(early, { held: true, pressedAt: early }), false, `shot at +${early - last} ms (start ${start}, late by ${lateBy})`);
      assert.ok(ws.tryFire(last + interval, { held: true, pressedAt: last + interval }), `shot at +${interval} ms`);
    }
  });
}

// ---------- jump ----------
// Body: jumpY = height above normal eye height, vy = vertical speed, onGround.
const ground = () => ({ jumpY: 0, vy: 0, onGround: true });

// Steps the body until it lands (or 2 s) and returns the peak height and the air time.
function flight(body, steps) {
  let peak = body.jumpY;
  let t = 0;
  for (let i = 0; !body.onGround && t < 2; i++) {
    const dt = steps[i % steps.length];
    stepJump(body, dt);
    t += dt;
    peak = Math.max(peak, body.jumpY);
  }
  return { peak, airTime: t };
}

test('jump numbers live in config: gravity 20, peak 1.2, air time about 0.7 s', () => {
  assert.equal(JUMP.gravity, 20);
  assert.equal(JUMP.peakHeight, 1.2);
  const airTime = (2 * JUMP.velocity) / JUMP.gravity;
  assert.ok(Math.abs(airTime - 0.7) < 0.05, `air time ${airTime}`);
});

for (const steps of [[1 / 60], [1 / 144], [1 / 30], [0.016, 0.033, 0.007, 0.05]]) {
  test(`jump peak 1.2 +- 0.1 and landing at eye height within 0.8 s, frames ${steps.map((s) => (s * 1000).toFixed(1)).join('/')} ms`, () => {
    const body = ground();
    assert.equal(tryJump(body), true);
    assert.equal(body.onGround, false);
    const { peak, airTime } = flight(body, steps);
    assert.ok(Math.abs(peak - 1.2) <= 0.1, `peak ${peak}`);
    assert.ok(airTime <= 0.8 && airTime >= 0.6, `air time ${airTime}`);
    assert.equal(body.onGround, true);
    assert.equal(body.jumpY, 0, 'lands exactly at normal eye height');
    assert.equal(body.vy, 0);
  });
}

test('no double jump: a second jump in the air does nothing', () => {
  const body = ground();
  assert.equal(tryJump(body), true);
  for (let i = 0; i < 10; i++) stepJump(body, 1 / 60);
  const vy = body.vy;
  const y = body.jumpY;
  assert.equal(tryJump(body), false);
  assert.equal(body.vy, vy);
  assert.equal(body.jumpY, y);
  const { peak } = flight(body, [1 / 60]);
  assert.ok(peak <= 1.3, `peak ${peak}`);
  assert.equal(body.jumpY, 0);
});

test('jump works again after landing; standing still on the ground stays at 0', () => {
  const body = ground();
  stepJump(body, 1 / 60);
  assert.equal(body.jumpY, 0);
  assert.equal(body.onGround, true);
  tryJump(body);
  flight(body, [1 / 60]);
  assert.equal(tryJump(body), true);
});
