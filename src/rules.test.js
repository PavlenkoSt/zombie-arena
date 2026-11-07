import test from 'node:test';
import assert from 'node:assert/strict';
import { zombieCountForWave, zombieSpeedForWave, hitsToKill } from './rules.js';
import { WEAPONS, ZOMBIE } from './config.js';
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
  for (let t = 0; t < seconds * 1000; t += frameMs) {
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
