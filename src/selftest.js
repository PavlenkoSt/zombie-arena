import { zombieCountForWave, zombieSpeedForWave } from './rules.js';
import { mulberry32 } from './rng.js';
import { WEAPONS, CRATES, PLAYER } from './config.js';

// Browser self-test: drives the real game code with fixed time steps.
// Open /?selftest and read the result list.

const DT = 1 / 60;
const results = [];

export async function run(game) {
  game.rand = mulberry32(5);
  const out = document.createElement('pre');
  out.id = 'selftest';
  out.style.cssText =
    'position:fixed;inset:0;z-index:50;margin:0;padding:96px 16px 16px;background:#000;color:#ddd;font:13px/1.35 monospace;overflow:auto;white-space:pre-wrap';
  document.body.appendChild(out);

  // Summary box at the top of the page: passed, failed and page-error counts.
  const summary = document.createElement('div');
  summary.id = 'selftest-summary';
  summary.style.cssText =
    'position:fixed;top:0;left:0;right:0;z-index:51;padding:18px 16px;font:bold 28px/1.2 monospace;color:#fff;background:#555;border-bottom:3px solid #000';
  summary.textContent = 'SELFTEST RUNNING…';
  document.body.appendChild(summary);

  const check = (name, ok, detail = '') => {
    results.push(ok);
    out.textContent += `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  [' + detail + ']' : ''}\n`;
  };
  const step = (n) => {
    for (let i = 0; i < n; i++) game.update(DT);
  };
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const fresh = (weapon = 0) => {
    game.autoWaves = false;
    game.start({ lock: false });
    game.zombies.clear();
    game.hud.hideBanner();
    if (weapon) game.selectWeapon(weapon);
    game.onShot = null;
    return game.player;
  };
  const dummy = (x, z) => game.zombies.spawn(x, z, 0);
  const click = () => (game.input.pressedAt = game.time);

  out.textContent += 'ZOMBIE ARENA self-test\n\n';

  // --- start screen ---
  game.state = 'menu';
  const startText = game.hud.startScreen.textContent;
  check('start screen shows title and prompt', startText.includes('ZOMBIE ARENA') && startText.includes('Click to play'));

  // --- weapons: rifle ---
  {
    fresh(0);
    const z = dummy(0, -5);
    const hits = [];
    const origDamage = game.zombies.damage.bind(game.zombies);
    game.zombies.damage = (zz, amt, now) => {
      hits.push(amt);
      return origDamage(zz, amt, now);
    };
    game.input.held = true;
    click();
    for (let i = 0; i < 200 && z.state === 'alive'; i++) step(1);
    game.input.held = false;
    game.zombies.damage = origDamage;
    check('rifle: zombie dies after 7 hits of 15 damage', hits.length === 7 && hits.every((h) => h === 15) && z.state === 'dying', `hits=${hits.length}`);
    check('rifle kill counted', game.kills === 1, `kills=${game.kills}`);
  }
  {
    fresh(0);
    const times = [];
    game.onShot = (def, t) => times.push(t);
    game.input.held = true;
    click();
    step(60);
    check('rifle: 10 shots in the first second', times.length === 10, `shots=${times.length}`);
    step(200);
    game.input.held = false;
    const span = times[29] - times[0];
    check('rifle: mag 30, 30th shot 2900 ms after the first', times.length === 30 && near(span, 2900, 17), `shots=${times.length} span=${span.toFixed(1)}ms`);
    check('rifle: mag empty then auto reload starts', game.weapon.mag === 0 && game.weapon.reloading);
    const startAt = game.weapon.reloadEnd - 2000;
    let t = 0;
    while (game.weapon.reloading && t < 400) {
      step(1);
      t++;
    }
    const took = game.time - startAt;
    check('rifle: reload 2000 ms, mag back to 30', near(took, 2000, 17) && game.weapon.mag === 30, `took=${took.toFixed(1)}ms mag=${game.weapon.mag}`);
  }
  {
    fresh(0);
    game.input.held = true;
    click();
    step(20);
    game.input.held = false;
    const before = game.weapon.mag;
    game.input.keys.add('KeyR');
    game.reload();
    const t0 = game.time;
    let n = 0;
    while (game.weapon.reloading && n < 400) {
      step(1);
      n++;
    }
    check('R key reload (rifle) takes 2000 ms', near(game.time - t0, 2000, 17) && before < 30 && game.weapon.mag === 30, `took=${(game.time - t0).toFixed(1)}ms`);
  }

  // --- pistol ---
  {
    fresh(1);
    step(1);
    check('key 2 selects pistol', game.weapon.def.id === 'pistol' && game.hud.weaponName.textContent === 'Pistol');
    const z = dummy(0, -5);
    let hits = 0;
    const origDamage = game.zombies.damage.bind(game.zombies);
    game.zombies.damage = (zz, a, n) => {
      hits++;
      return origDamage(zz, a, n);
    };
    for (let i = 0; i < 200 && z.state === 'alive'; i++) {
      click();
      step(1);
    }
    game.zombies.damage = origDamage;
    check('pistol: zombie dies after 3 hits of 35 damage', hits === 3 && z.state === 'dying', `hits=${hits}`);
  }
  {
    fresh(1);
    const times = [];
    game.onShot = (d, t) => times.push(t);
    for (let i = 0; i < 60; i++) {
      click();
      step(1);
    }
    check('pistol: max 4 shots per second when clicking every frame', times.length === 4, `shots=${times.length}`);
  }
  {
    fresh(1);
    let shots = 0;
    game.onShot = () => shots++;
    game.input.held = true;
    click();
    step(120);
    game.input.held = false;
    check('pistol: holding the button gives one shot', shots === 1, `shots=${shots}`);
  }
  {
    fresh(1);
    for (let i = 0; i < 12; i++) {
      step(16);
      click();
      step(1);
    }
    step(1);
    check('pistol: mag 12 empties after 12 shots, reload starts', game.weapon.mag === 0 && game.weapon.reloading, `mag=${game.weapon.mag}`);
    const startAt = game.weapon.reloadEnd - 1200;
    let n = 0;
    while (game.weapon.reloading && n < 300) {
      step(1);
      n++;
    }
    check('pistol: reload 1200 ms, mag back to 12', near(game.time - startAt, 1200, 17) && game.weapon.mag === 12, `took=${(game.time - startAt).toFixed(1)}ms`);
  }

  // --- knife ---
  {
    fresh(2);
    step(1);
    check('key 3 selects knife', game.weapon.def.id === 'knife' && game.hud.ammoCount.textContent.includes('∞'));
    const z = dummy(0, -1.9);
    let swings = [];
    game.onShot = (d, t) => swings.push(t);
    game.input.held = true;
    click();
    step(60);
    check('knife: 2 swings in the first second (500 ms apart)', swings.length === 2 && near(swings[1] - swings[0], 500, 17), `swings=${swings.length}`);
    check('knife: zombie dies after 2 hits of 60 damage', z.state === 'dying' && z.hp === 0, `hp=${z.hp}`);
    game.input.held = false;
  }
  {
    fresh(2);
    const far = dummy(0, -2.15);
    game.input.held = true;
    click();
    step(3);
    check('knife: range 2 (zombie at 2.15 is not hit)', far.hp === 100, `hp=${far.hp}`);
    game.zombies.clear();
    const near1 = dummy(0, -1.9);
    game.input.held = false;
    step(40);
    game.input.held = true;
    click();
    step(3);
    check('knife: zombie at 1.9 is hit', near1.hp === 40, `hp=${near1.hp}`);
    game.input.held = false;
  }

  // --- wheel / switching ---
  {
    fresh(0);
    game.selectWeapon(1);
    game.selectWeapon(2);
    game.selectWeapon(0);
    check('weapons keep their own mag after switching', game.weapons[0].mag === 30 && game.weapons[1].mag === 12);
    const models = game.view.models.map((m) => m.group.children.length);
    check('three different first-person models', new Set(models).size === 3, `parts=${models.join('/')}`);
  }

  // --- movement ---
  {
    const p = fresh(0);
    game.input.keys.add('KeyW');
    step(60);
    check('walk 5 units/s', near(-p.z, 5, 0.05), `dz=${(-p.z).toFixed(3)}`);
    game.input.keys.add('ShiftLeft');
    const z0 = p.z;
    step(60);
    check('sprint 8 units/s', near(z0 - p.z, 8, 0.05), `dz=${(z0 - p.z).toFixed(3)}`);
    game.input.keys.clear();
  }
  {
    const p = fresh(0);
    game.input.keys.add('KeyW');
    game.input.keys.add('ShiftLeft');
    step(60 * 8);
    check('player stops at the north wall', p.z >= -29.6 - 1e-6 && p.z <= -29.5, `z=${p.z.toFixed(3)}`);
    p.yaw = -Math.PI / 2; // face +x
    step(60 * 8);
    check('player stops at the east wall', p.x <= 29.6 + 1e-6 && p.x >= 29.5, `x=${p.x.toFixed(3)}`);
    p.yaw = Math.PI / 2;
    step(60 * 10);
    check('player stops at the west wall', p.x >= -29.6 - 1e-6 && p.x <= -29.5, `x=${p.x.toFixed(3)}`);
    p.yaw = Math.PI;
    step(60 * 10);
    check('player stops at the south wall', p.z <= 29.6 + 1e-6 && p.z >= 29.5, `z=${p.z.toFixed(3)}`);
    game.input.keys.clear();
  }
  {
    const p = fresh(0);
    const c = CRATES[0];
    p.x = c.x;
    p.z = c.z + 6;
    p.yaw = 0;
    game.input.keys.add('KeyW');
    step(60 * 3);
    const box = game.arena.boxes[0];
    const inside = p.x > box.minX && p.x < box.maxX && p.z > box.minZ && p.z < box.maxZ;
    check('player cannot walk into a crate', !inside && p.z >= box.maxZ + 0.39, `z=${p.z.toFixed(3)} crateEdge=${box.maxZ}`);
    game.input.keys.clear();
  }

  // --- jump (real Space key events, height read from the camera) ---
  {
    const p = fresh(0);
    const eye = PLAYER.eyeHeight;
    const key = (type) => document.dispatchEvent(new KeyboardEvent(type, { code: 'Space', key: ' ', bubbles: true, cancelable: true }));
    const camY = () => game.camera.position.y;
    step(1);
    check('jump: camera at normal eye height before the jump', camY() === eye, `y=${camY()}`);
    key('keydown');
    key('keyup');
    let peak = camY();
    let peakAt = 0;
    let frames = 0;
    let secondAt = -1;
    let afterSecond = null;
    while (frames < 120) {
      step(1);
      frames++;
      if (camY() > peak) {
        peak = camY();
        peakAt = frames;
      }
      if (frames === 10) {
        // Second press in the air, while rising: no double jump.
        const vy = p.vy;
        key('keydown');
        key('keyup');
        secondAt = frames;
        afterSecond = { vy, vyNow: p.vy };
      }
      if (frames > 1 && camY() === eye) break;
    }
    const rise = peak - eye;
    check('jump: Space rises 1.2 +- 0.1 above eye height', Math.abs(rise - 1.2) <= 0.1, `peak=+${rise.toFixed(3)} at ${((peakAt * 1000) / 60).toFixed(0)}ms`);
    const airMs = (frames * 1000) / 60;
    check('jump: lands back at normal eye height within 0.8 s', camY() === eye && p.jumpY === 0 && p.onGround && airMs <= 800, `y=${camY()} air=${airMs.toFixed(0)}ms`);
    check('jump: second Space in the air does nothing (no double jump)', secondAt === 10 && afterSecond && afterSecond.vyNow === afterSecond.vy && rise <= 1.3, afterSecond ? `vy ${afterSecond.vy.toFixed(3)} -> ${afterSecond.vyNow.toFixed(3)}` : 'no second press');
    step(5);
    check('jump: stays on the floor after landing', camY() === eye && p.onGround, `y=${camY()}`);
    key('keydown');
    key('keyup');
    step(1);
    check('jump: Space jumps again after landing', camY() > eye, `y=${camY().toFixed(3)}`);
  }
  {
    // Movement and aim keep working in the air.
    const p = fresh(0);
    game.input.keys.add('KeyW');
    game.jump();
    step(30);
    const inAir = !p.onGround && p.jumpY > 0.3;
    check('jump: walk forward keeps 5 units/s in the air', inAir && near(-p.z, 2.5, 0.05), `dz=${(-p.z).toFixed(3)} y=+${p.jumpY.toFixed(2)}`);
    const yaw0 = p.yaw;
    game.turn(-0.2, 0.1);
    game.updateVisuals(0);
    check('jump: aim turns in the air', near(p.yaw - yaw0, -0.2, 1e-9) && near(game.camera.rotation.y, p.yaw, 1e-9) && !p.onGround);
    game.input.keys.clear();
    step(60);
    check('jump: lands at eye height after moving in the air', p.onGround && game.camera.position.y === PLAYER.eyeHeight);
  }
  {
    // Space does nothing outside play.
    fresh(0);
    game.state = 'paused';
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true }));
    const grounded = game.player.onGround;
    game.state = 'playing';
    check('jump: no jump while paused', grounded === true);
  }

  // --- zombies ---
  {
    fresh(0);
    check('wave speeds: 2.0, 2.15, max 4', zombieSpeedForWave(1) === 2.0 && near(zombieSpeedForWave(2), 2.15, 1e-9) && zombieSpeedForWave(50) === 4);
    const z = game.zombies.spawn(0, -10, zombieSpeedForWave(1));
    step(60);
    check('zombie walks toward player at 2.0 units/s', near(z.z, -8, 0.05), `z=${z.z.toFixed(3)}`);
  }
  {
    const p = fresh(0);
    const z = dummy(0, -1.2);
    z.speed = 0;
    step(1);
    check('zombie hits at once within 1.5 units (-10 HP)', p.hp === 90, `hp=${p.hp}`);
    step(55);
    check('zombie cooldown: no second hit before 1000 ms', p.hp === 90, `hp=${p.hp}`);
    step(10);
    check('second hit after 1000 ms', p.hp === 80, `hp=${p.hp}`);
    z.x = 0;
    z.z = -1.6;
    step(130);
    check('no damage from outside 1.5 units', p.hp === 80, `hp=${p.hp}`);
  }
  {
    fresh(0);
    const z = dummy(0, -5);
    game.input.held = true;
    click();
    step(1);
    game.input.held = false;
    check('hit flash starts red then clears', z.matMode === 'flash');
    step(12);
    check('hit flash clears after ~120 ms', z.matMode === 'base', z.matMode);
    game.zombies.damage(z, 100, game.time);
    step(40);
    const rotated = z.group.rotation.x > 1.5;
    step(60 * 1.5);
    check('zombie falls on death and is removed after fading', rotated && !game.zombies.list.includes(z));
  }
  {
    // Zombies do not shoot through crates, and crates block shots.
    const p = fresh(0);
    const c = CRATES[0];
    p.x = c.x;
    p.z = c.z + 5;
    p.yaw = 0;
    const behind = dummy(c.x, c.z - 3);
    game.input.held = true;
    click();
    step(3);
    game.input.held = false;
    check('crate blocks a rifle shot', behind.hp === 100, `hp=${behind.hp}`);
  }

  // --- waves ---
  {
    game.autoWaves = true;
    game.start({ lock: false });
    check('wave 1 spawns 8 zombies and shows the WAVE 1 banner', game.zombies.aliveCount() === zombieCountForWave(1) && game.hud.bannerEl.textContent === 'WAVE 1' && game.hud.bannerVisible, `n=${game.zombies.aliveCount()}`);
    step(60 * 1.9);
    const v1 = game.hud.bannerVisible;
    step(60 * 0.2);
    check('banner lasts 2 s', v1 && !game.hud.bannerVisible);
    for (const z of game.zombies.list) game.zombies.damage(z, 100, game.time), game.kills++;
    check('kills counted', game.kills === 8);
    const t0 = game.time;
    step(60 * 4.8);
    check('next wave waits 5 s after last kill', game.wave === 1, `wave=${game.wave}`);
    while (game.wave === 1 && game.time - t0 < 6000) step(1);
    const waited = game.time - t0;
    check('wave 2 starts 5 s after last kill with 11 zombies', game.wave === 2 && game.zombies.aliveCount() === 11 && waited >= 5000 && waited <= 5017, `wave=${game.wave} n=${game.zombies.aliveCount()} waited=${waited.toFixed(1)}ms`);
    check('WAVE 2 banner visible', game.hud.bannerEl.textContent === 'WAVE 2' && game.hud.bannerVisible && game.hud.waveEl.textContent === 'Wave 2');
    check('wave 2 zombies move at 2.15', game.zombies.list.filter((z) => z.state === 'alive').every((z) => near(z.speed, 2.15, 1e-9)));
    check('wave counts 5+3N: 8,11,14,17', [1, 2, 3, 4].map(zombieCountForWave).join() === '8,11,14,17');
    // spawn points lie along the walls
    const onWall = game.zombies.list.filter((z) => z.state === 'alive').every((z) => Math.max(Math.abs(z.x), Math.abs(z.z)) > 28);
    check('zombies spawn along the walls', onWall);
  }

  // --- death and restart ---
  {
    const p = fresh(0);
    p.hp = 10;
    const z = dummy(0, -1.2);
    z.speed = 0;
    game.kills = 4;
    game.wave = 3;
    step(2);
    const go = game.hud.gameOver;
    check('0 HP: game over overlay with YOU DIED, wave, kills', game.state === 'dead' && !go.classList.contains('hidden') && go.textContent.includes('YOU DIED') && go.textContent.includes('Wave reached: 3') && go.textContent.includes('Kills: 4') && go.textContent.includes('Click to restart'));
    go.click();
    check('restart click is ignored within 600 ms', game.state === 'dead');
    await new Promise((r) => setTimeout(r, 700));
    go.click();
    const alive = game.zombies.aliveCount();
    check('click restarts at wave 1, 100 HP, 0 kills, full rifle mag', game.state === 'playing' && game.wave === 1 && game.player.hp === 100 && game.kills === 0 && game.weapon.def.id === 'rifle' && game.weapon.mag === 30 && alive === 8 && go.classList.contains('hidden'), `wave=${game.wave} hp=${game.player.hp} n=${alive}`);
  }

  // --- performance: 40 zombies ---
  {
    fresh(0);
    game.state = 'playing';
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const z = game.zombies.spawn(Math.cos(a) * (6 + (i % 5) * 4), Math.sin(a) * (6 + (i % 5) * 4), 2);
      z.moving = true;
    }
    const gl = game.renderer.getContext();
    const px = new Uint8Array(4);
    const frames = 90;
    const samples = [];
    game.renderer.info.autoReset = false;
    for (let i = 0; i < frames; i++) {
      game.renderer.info.reset();
      const t = performance.now();
      game.player.yaw += 0.03;
      game.updateVisuals(DT);
      game.zombies.update(DT, game.time, game.player, game.arena, false, () => {});
      game.render();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); // forces the GPU to finish
      samples.push(performance.now() - t);
    }
    samples.sort((a, b) => a - b);
    const avg = samples.reduce((s, v) => s + v, 0) / samples.length;
    out.textContent += `INFO  40 zombies: avg ${avg.toFixed(2)} ms/frame, p95 ${samples[Math.floor(frames * 0.95)].toFixed(2)} ms, draw calls ${game.renderer.info.render.calls}, geometries ${game.renderer.info.memory.geometries}\n`;
    check('40 zombies render in under 16 ms per frame (measured here)', avg < 16.6, `avg=${avg.toFixed(2)}ms`);
    game.zombies.clear();
  }

  // --- real animation loop (not stepped by hand) ---
  {
    fresh(0);
    game.manual = false;
    let frames = 0;
    const origRender = game.render.bind(game);
    game.render = () => {
      frames++;
      origRender();
    };
    game.input.keys.add('KeyW');
    await new Promise((r) => setTimeout(r, 2000));
    game.input.keys.clear();
    game.render = origRender;
    game.manual = true;
    const moved = -game.player.z;
    out.textContent += `INFO  live loop: ${frames} frames in 2 s, game time ${game.time.toFixed(0)} ms, moved ${moved.toFixed(2)} units, visibility ${document.visibilityState}\n`;
    if (document.visibilityState === 'hidden') {
      out.textContent += 'NOT RUN  live loop check: the tab is hidden, so the browser sends no animation frames\n';
    } else {
      check('live loop runs and the player moves with real time', frames > 5 && moved > 0, `frames=${frames} moved=${moved.toFixed(2)}`);
    }
  }

  game.state = 'menu';
  check('no page errors', window.__errors.length === 0, window.__errors.join(' | '));
  const passed = results.filter(Boolean).length;
  const failed = results.length - passed;
  const pageErrors = window.__errors.length;
  out.textContent += `\nSELFTEST ${failed === 0 ? 'OK' : 'FAILED'}: ${passed}/${results.length} passed\n`;
  summary.textContent = `SELFTEST ${failed === 0 && pageErrors === 0 ? 'OK' : 'FAILED'}: ${passed} / ${results.length} passed, ${failed} failed, ${pageErrors} page errors`;
  summary.style.background = failed === 0 && pageErrors === 0 ? '#1e7a34' : '#c0392b';
  window.__selftest = { passed, failed, pageErrors, total: results.length };
}
