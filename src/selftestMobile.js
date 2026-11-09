import { mulberry32 } from './rng.js';

// Browser self-test for the touch controls: open /?selftest=mobile (forces mobile mode).
// Behaviour checks send real TouchEvents to the page and step the game with fixed time steps.
// Layout checks load the shot scenes in iframes of exact phone sizes (844x390 and 390x844).

const DT = 1 / 60;
const DEG = Math.PI / 180;
const results = [];

export async function run(game) {
  game.rand = mulberry32(5);
  const out = document.createElement('pre');
  out.id = 'selftest';
  out.style.cssText =
    'position:fixed;inset:0;z-index:50;margin:0;padding:96px 16px 16px;background:#000;color:#ddd;font:13px/1.35 monospace;overflow:auto;white-space:pre-wrap;pointer-events:none';
  const summary = document.createElement('div');
  summary.id = 'selftest-summary';
  summary.style.cssText =
    'position:fixed;top:0;left:0;right:0;z-index:51;padding:18px 16px;font:bold 28px/1.2 monospace;color:#fff;background:#555;border-bottom:3px solid #000;pointer-events:none';
  summary.textContent = 'MOBILE SELFTEST RUNNING…';
  document.body.appendChild(out);
  document.body.appendChild(summary);

  const check = (name, ok, detail = '') => {
    results.push(!!ok);
    out.textContent += `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  [' + detail + ']' : ''}\n`;
  };
  const step = (n) => {
    for (let i = 0; i < n; i++) game.update(DT);
  };
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const $ = (id) => document.getElementById(id);
  const rect = (el) => (el ? el.getBoundingClientRect() : null);
  const circle = (el) => !!el && getComputedStyle(el).borderRadius === '50%';

  out.textContent += 'ZOMBIE ARENA mobile self-test\n\n';
  try {
    await body();
  } catch (e) {
    check('self-test ran to the end', false, String(e && e.stack ? e.stack.split('\n')[0] : e));
  }
  finish();

  async function body() {
    // ---------- touch helpers (real TouchEvents) ----------
    let canTouch = true;
    try {
      new TouchEvent('touchstart', { touches: [], changedTouches: [] });
      new Touch({ identifier: 0, target: document.body, clientX: 0, clientY: 0 });
    } catch (e) {
      canTouch = false;
    }
    const live = new Map(); // identifier -> Touch
    const send = (type, id, x, y) => {
      const prev = live.get(id);
      const target = prev ? prev.target : document.elementFromPoint(x, y) || document.body;
      const t = new Touch({ identifier: id, target, clientX: x, clientY: y, pageX: x, pageY: y, radiusX: 8, radiusY: 8, force: 1 });
      if (type === 'touchend' || type === 'touchcancel') live.delete(id);
      else live.set(id, t);
      const ev = new TouchEvent(type, {
        bubbles: true,
        cancelable: true,
        touches: [...live.values()],
        targetTouches: [...live.values()].filter((o) => o.target === target),
        changedTouches: [t],
      });
      target.dispatchEvent(ev);
      return ev;
    };
    const down = (id, x, y) => send('touchstart', id, x, y);
    const move = (id, x, y) => send('touchmove', id, x, y);
    const up = (id, x, y) => send('touchend', id, x, y);
    const center = (el) => {
      const r = rect(el);
      return [r.left + r.width / 2, r.top + r.height / 2];
    };

    // ---------- mode and page setup ----------
    check("body has class 'mobile'", document.body.classList.contains('mobile'));
    check('game is in mobile mode', game.mobile === true);
    const meta = document.querySelector('meta[name=viewport]');
    const metaText = meta ? meta.content.replace(/\s/g, '') : '';
    check('viewport meta: user-scalable=no, maximum-scale=1', metaText.includes('user-scalable=no') && metaText.includes('maximum-scale=1'), metaText);
    check('touch-action none on html, body and canvas', ['html', 'body', 'canvas'].every((s) => getComputedStyle(document.querySelector(s)).touchAction === 'none'));
    const fire = $('touch-fire');
    const reload = $('touch-reload');
    const sw = $('touch-switch');
    check('fire, reload and switch buttons exist', !!fire && !!reload && !!sw);

    // ---------- start without pointer lock ----------
    {
      let lockCalls = 0;
      const origLock = game.canvas.requestPointerLock;
      game.canvas.requestPointerLock = () => {
        lockCalls++;
      };
      game.state = 'menu';
      game.hud.showStart(true, game.mobile ? 'Tap to play' : 'Click to play');
      check('start screen asks to tap', game.hud.startScreen.textContent.includes('Tap to play'));
      game.hud.startScreen.click();
      game.canvas.requestPointerLock = origLock;
      check('tap on the start overlay starts the game without pointer lock', game.state === 'playing' && lockCalls === 0, `state=${game.state} lockCalls=${lockCalls}`);
      check('touch controls show while playing', !!fire && getComputedStyle($('touch-ui')).display !== 'none');
    }

    const fresh = (weapon = 0) => {
      game.autoWaves = false;
      game.start({ lock: false });
      game.zombies.clear();
      game.hud.hideBanner();
      if (weapon) game.selectWeapon(weapon);
      game.onShot = null;
      return game.player;
    };
    const W = window.innerWidth;
    const H = window.innerHeight;

    if (!canTouch) {
      out.textContent += 'NOT RUN  touch behaviour checks: this browser cannot create TouchEvent objects\n';
    } else if (!fire) {
      check('touch behaviour checks need the touch controls', false, 'no #touch-fire');
    } else {
      // ---------- joystick ----------
      {
        const p = fresh(0);
        const sx = W * 0.2;
        const sy = H * 0.6;
        const ev = down(1, sx, sy);
        check('left touch start is not scrolled / zoomed (preventDefault)', ev.defaultPrevented);
        const base = $('joy-base');
        const knob = $('joy-knob');
        const br = rect(base);
        const kr = rect(knob);
        check('joystick shows at the touch point', getComputedStyle($('joystick')).display !== 'none' && near(br.left + br.width / 2, sx, 1) && near(br.top + br.height / 2, sy, 1), `center=${(br.left + br.width / 2).toFixed(0)},${(br.top + br.height / 2).toFixed(0)} touch=${sx.toFixed(0)},${sy.toFixed(0)}`);
        check('joystick base 120 px, knob 56 px, both circles', near(br.width, 120, 0.5) && near(br.height, 120, 0.5) && near(kr.width, 56, 0.5) && near(kr.height, 56, 0.5) && circle(base) && circle(knob), `base=${br.width}x${br.height} knob=${kr.width}x${kr.height}`);
        check('joystick colours', getComputedStyle(base).backgroundColor === 'rgba(255, 255, 255, 0.25)' && getComputedStyle(knob).backgroundColor === 'rgba(255, 255, 255, 0.6)', `${getComputedStyle(base).backgroundColor} / ${getComputedStyle(knob).backgroundColor}`);

        move(1, sx, sy - 30); // half way up
        step(60);
        check('joystick half up: walk forward at half speed (2.5 units/s)', near(-p.z, 2.5, 0.05) && near(p.x, 0, 1e-6), `dz=${(-p.z).toFixed(3)}`);
        move(1, sx + 200, sy); // far right: knob clamps at 60 px
        const kr2 = rect(knob);
        check('knob offset is clamped to 60 px', near(kr2.left + kr2.width / 2 - sx, 60, 0.5), `dx=${(kr2.left + kr2.width / 2 - sx).toFixed(1)}`);
        const x0 = p.x;
        step(60);
        check('joystick full right: sprint strafe right at 8 units/s', near(p.x - x0, 8, 0.05), `dx=${(p.x - x0).toFixed(3)}`);
        move(1, sx, sy - 50); // 50/60 = 83%: below the sprint line
        const z1 = p.z;
        step(60);
        check('joystick at 83%: walk, no sprint (4.17 units/s)', near(z1 - p.z, 5 * (50 / 60), 0.05), `dz=${(z1 - p.z).toFixed(3)}`);
        move(1, sx, sy - 56); // 56/60 = 93%: past 90% = sprint
        const z2 = p.z;
        step(60);
        check('joystick past 90%: sprint 8 units/s', near(z2 - p.z, 8, 0.05), `dz=${(z2 - p.z).toFixed(3)}`);

        // ---------- right-side look with the stick still held (two touches) ----------
        const yaw0 = p.yaw;
        const pitch0 = p.pitch;
        const lx = W * 0.7;
        const ly = H * 0.4;
        down(2, lx, ly);
        move(2, lx + 40, ly);
        move(1, sx, sy - 56);
        check('right drag 40 px turns right by 10 deg while the stick is held', near(p.yaw - yaw0, -40 * 0.25 * DEG, 1e-9) && game.touch.stickActive, `dyaw=${((p.yaw - yaw0) / DEG).toFixed(3)}deg`);
        move(2, lx + 40, ly - 20);
        check('right drag 20 px up looks up by 5 deg', near(p.pitch - pitch0, 20 * 0.25 * DEG, 1e-9), `dpitch=${((p.pitch - pitch0) / DEG).toFixed(3)}deg`);
        const z3 = p.z;
        step(30);
        check('player keeps moving while the other thumb looks', z3 - p.z > 3.9, `dz=${(z3 - p.z).toFixed(3)}`);
        move(2, lx + 40, ly + 5000);
        check('pitch clamp same as mouse (-1.45)', near(p.pitch, -1.45, 1e-9), `pitch=${p.pitch.toFixed(3)}`);
        move(2, lx + 40, ly - 10000);
        check('pitch clamp same as mouse (+1.45)', near(p.pitch, 1.45, 1e-9), `pitch=${p.pitch.toFixed(3)}`);
        up(2, lx + 40, ly - 10000);
        up(1, sx, sy - 56);
        check('joystick hides on release', getComputedStyle($('joystick')).display === 'none');
        const z4 = p.z;
        step(30);
        check('player stops when the stick is released', p.z === z4);
      }

      // ---------- fire ----------
      {
        fresh(0);
        const times = [];
        game.onShot = (d, t) => times.push(t);
        const [fx, fy] = center(fire);
        const ev = down(3, fx, fy);
        check('fire touch is not scrolled / zoomed (preventDefault)', ev.defaultPrevented);
        step(60);
        check('hold fire (rifle): 10 shots in 1 s, mag 30 -> 20', times.length === 10 && game.weapon.mag === 20, `shots=${times.length} mag=${game.weapon.mag}`);
        check('ammo HUD drops', game.hud.ammoCount.textContent === '20 / ∞', game.hud.ammoCount.textContent);
        const yaw0 = game.player.yaw;
        move(3, fx - 20, fy);
        check('drag on the fire button aims (20 px left = +5 deg)', near(game.player.yaw - yaw0, 20 * 0.25 * DEG, 1e-9), `dyaw=${((game.player.yaw - yaw0) / DEG).toFixed(3)}deg`);
        step(30);
        check('keeps firing while the thumb drags', times.length === 15, `shots=${times.length}`);
        up(3, fx - 20, fy);
        step(30);
        check('release fire: no more shots', times.length === 15, `shots=${times.length}`);
      }
      {
        fresh(0);
        // Fire with the left stick and a right look at the same time: three touches.
        const [fx, fy] = center(fire);
        down(1, W * 0.2, H * 0.6);
        move(1, W * 0.2, H * 0.6 - 30);
        down(2, W * 0.6, H * 0.3);
        down(3, fx, fy);
        step(30);
        move(2, W * 0.6 + 8, H * 0.3);
        check('stick + look + fire at once', game.shots === 5 && game.player.z < -1 && game.player.yaw < 0, `shots=${game.shots} z=${game.player.z.toFixed(2)}`);
        up(3, fx, fy);
        up(2, W * 0.6 + 8, H * 0.3);
        up(1, W * 0.2, H * 0.6 - 30);
      }
      {
        fresh(1);
        let shots = 0;
        game.onShot = () => shots++;
        const [fx, fy] = center(fire);
        down(4, fx, fy);
        step(120);
        up(4, fx, fy);
        check('pistol: holding fire gives one shot (click rules)', shots === 1, `shots=${shots}`);
        for (let i = 0; i < 60; i++) {
          down(4, fx, fy);
          up(4, fx, fy);
          step(1);
        }
        check('pistol: tapping every frame gives max 4 shots/s', shots === 1 + 4, `shots=${shots}`);
      }
      {
        fresh(2);
        let swings = 0;
        game.onShot = () => swings++;
        const [fx, fy] = center(fire);
        down(5, fx, fy);
        step(60);
        up(5, fx, fy);
        check('knife: holding fire swings 2 times in 1 s', swings === 2, `swings=${swings}`);
      }

      // ---------- switch and reload ----------
      {
        fresh(0);
        const tap = (el, id) => {
          const [x, y] = center(el);
          const ev = down(id, x, y);
          up(id, x, y);
          return ev;
        };
        const order = [game.weapon.def.id];
        for (let i = 0; i < 3; i++) {
          tap(sw, 6);
          step(1);
          order.push(game.weapon.def.id);
        }
        check('switch taps cycle rifle -> pistol -> knife -> rifle', order.join(',') === 'rifle,pistol,knife,rifle', order.join(','));
        check('HUD weapon name follows the switch', game.hud.weaponName.textContent === 'Rifle');
        game.touch.lastPress = {}; // the taps above were less than 1 s ago in real time
        sw.click(); // plain click, no press before it: one tap
        const afterClick = game.weapon.def.id;
        tap(sw, 6);
        sw.click(); // click that follows a real press: ignored
        check('plain click on switch = one tap; click after a touch tap is ignored', afterClick === 'pistol' && game.weapon.def.id === 'knife', `${afterClick},${game.weapon.def.id}`);
        game.selectWeapon(0);
        const [fx, fy] = center(fire);
        down(3, fx, fy);
        step(12);
        up(3, fx, fy);
        const mag = game.weapon.mag;
        tap(reload, 7);
        step(1);
        check('reload tap starts the reload', mag < 30 && game.weapon.reloading, `mag=${mag}`);
        step(125);
        check('reload finishes: mag 30', game.weapon.mag === 30 && !game.weapon.reloading);
        const ev = tap(reload, 7);
        check('reload button touch is not scrolled / zoomed', ev.defaultPrevented);
      }
    }

    // ---------- desktop handlers do nothing in mobile mode ----------
    {
      fresh(0);
      document.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
      step(10);
      document.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
      check('compat mouse events do not fire the gun on mobile', game.shots === 0, `shots=${game.shots}`);
    }

    // ---------- layout at exact phone sizes ----------
    const frameCheck = (w, h, shot) =>
      new Promise((resolve) => {
        const f = document.createElement('iframe');
        f.style.cssText = `position:fixed;left:0;top:0;width:${w}px;height:${h}px;border:0;opacity:0;pointer-events:none`;
        f.src = `${location.pathname}?mobile=1&shot=${shot}`;
        const timer = setTimeout(() => resolve({ error: 'timeout' }), 15000);
        f.onload = () => {
          const poll = () => {
            const d = f.contentDocument;
            if (!d || !d.getElementById('touch-fire') || !f.contentWindow.__game) return setTimeout(poll, 50);
            clearTimeout(timer);
            setTimeout(() => resolve({ f, d, win: f.contentWindow }), 100);
          };
          poll();
        };
        document.body.appendChild(f);
      });

    for (const [w, h, shot] of [
      [844, 390, 'mobile-landscape'],
      [390, 844, 'mobile-portrait'],
    ]) {
      const r = await frameCheck(w, h, shot);
      if (r.error) {
        check(`${w}x${h}: shot page loads`, false, r.error);
        continue;
      }
      const d = r.d;
      const g = (id) => d.getElementById(id).getBoundingClientRect();
      check(`${w}x${h}: iframe viewport is ${w}x${h}`, r.win.innerWidth === w && r.win.innerHeight === h, `${r.win.innerWidth}x${r.win.innerHeight}`);
      const fr = g('touch-fire');
      const rr = g('touch-reload');
      const sr = g('touch-switch');
      check(`${w}x${h}: fire 84 px circle, 32 px from right, 110 px from bottom`, fr.width === 84 && fr.height === 84 && near(w - fr.right, 32, 0.5) && near(h - fr.bottom, 110, 0.5) && r.win.getComputedStyle(d.getElementById('touch-fire')).borderRadius === '50%', `${fr.width}x${fr.height} right=${w - fr.right} bottom=${h - fr.bottom}`);
      check(`${w}x${h}: reload 56 px circle, 16 px left of fire, same centre line`, rr.width === 56 && rr.height === 56 && near(fr.left - rr.right, 16, 0.5) && near(rr.top + 28, fr.top + 42, 0.5), `gap=${fr.left - rr.right}`);
      check(`${w}x${h}: switch 56 px circle, 16 px above fire, same centre line`, sr.width === 56 && sr.height === 56 && near(fr.top - sr.bottom, 16, 0.5) && near(sr.left + 28, fr.left + 42, 0.5), `gap=${fr.top - sr.bottom}`);
      const buttons = [fr, rr, sr];
      check(`${w}x${h}: all buttons on screen and at least 44 px`, buttons.every((b) => b.left >= 0 && b.top >= 0 && b.right <= w && b.bottom <= h && b.width >= 44 && b.height >= 44));
      const hudIds = ['wave', 'kills', 'hp-text', 'health', 'weapon-name', 'ammo-count', 'reload-note'];
      const overlap = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      const hits = [];
      for (const id of hudIds) {
        const hr = g(id);
        if (hr.left < 0 || hr.top < 0 || hr.right > w || hr.bottom > h) hits.push(`${id} off screen`);
        buttons.forEach((b, i) => overlap(hr, b) && hits.push(`${id} under ${['fire', 'reload', 'switch'][i]}`));
      }
      check(`${w}x${h}: no button covers health, wave or ammo text; HUD on screen`, hits.length === 0, hits.join(', '));
      const hint = d.getElementById('rotate-hint');
      const hintShown = !!hint && r.win.getComputedStyle(hint).display !== 'none';
      if (h > w) {
        const hr = hint.getBoundingClientRect();
        const hintClear = hudIds.every((id) => !overlap(hr, g(id))) && buttons.every((b) => !overlap(hr, b));
        check(`${w}x${h}: 'Rotate for best play' hint shows and covers nothing`, hintShown && hint.textContent.includes('Rotate for best play') && hintClear);
        check(`${w}x${h}: game still playable in portrait`, r.win.__game.state === 'playing');
      } else {
        check(`${w}x${h}: no rotate hint in landscape`, !hintShown);
      }
      r.f.remove();
    }
  }

  function finish() {
    game.state = 'menu';
    check('no page errors', window.__errors.length === 0, window.__errors.join(' | '));
    const passed = results.filter(Boolean).length;
    const failed = results.length - passed;
    const pageErrors = window.__errors.length;
    out.textContent += `\nMOBILE SELFTEST ${failed === 0 ? 'OK' : 'FAILED'}: ${passed}/${results.length} passed\n`;
    summary.textContent = `MOBILE SELFTEST ${failed === 0 && pageErrors === 0 ? 'OK' : 'FAILED'}: ${passed} / ${results.length} passed, ${failed} failed, ${pageErrors} page errors`;
    summary.style.background = failed === 0 && pageErrors === 0 ? '#1e7a34' : '#c0392b';
    window.__selftest = { passed, failed, pageErrors, total: results.length };
  }
}

