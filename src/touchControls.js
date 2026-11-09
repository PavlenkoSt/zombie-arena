import { WEAPONS } from './config.js';

// Touch controls for phones and tablets: floating joystick (left half), drag to look
// (right half), hold-to-fire, reload and weapon switch buttons.

export const TOUCH = {
  baseSize: 120, // joystick base diameter, px
  knobSize: 56, // joystick knob diameter, px
  maxOffset: 60, // knob travel from the centre, px (= base radius)
  sprintAt: 0.9, // stick past 90 % of maxOffset = sprint
  deadZone: 0.08, // stick below 8 % = no movement
  lookDegPerPx: 0.25, // look sensitivity, both axes
};

const LOOK_RAD_PER_PX = (TOUCH.lookDegPerPx * Math.PI) / 180;

// Mobile when the URL says so (?mobile=1 / ?mobile=0), else when the main pointer is coarse,
// or the device has touch points and no fine pointer.
export function detectMobile(params, env) {
  const forced = params.get('mobile');
  if (forced === '1') return true;
  if (forced === '0') return false;
  const mq = (q) => !!(env.matchMedia && env.matchMedia(q).matches);
  if (mq('(pointer: coarse)')) return true;
  const points = (env.navigator && env.navigator.maxTouchPoints) || 0;
  return points > 0 && !mq('(pointer: fine)');
}

// Stick offset in px (dx right, dy down) -> knob position and movement.
// x: strafe right (-1..1), y: forward (-1..1), amount: 0..1 analog speed, sprint: past 90 %.
export function stickVector(dx, dy) {
  const len = Math.hypot(dx, dy);
  const max = TOUCH.maxOffset;
  const k = len > max ? max / len : 1;
  const knobX = dx * k;
  const knobY = dy * k;
  const amount = Math.min(1, len / max);
  if (amount < TOUCH.deadZone) return { knobX, knobY, x: 0, y: 0, amount: 0, sprint: false };
  return { knobX, knobY, x: knobX / max, y: -knobY / max, amount, sprint: amount > TOUCH.sprintAt };
}

// Finger movement in px -> yaw / pitch change in radians. Same signs as mouse look:
// drag right turns right (yaw goes down), drag up looks up (pitch goes up).
export function lookDelta(dx, dy) {
  return { yaw: -dx * LOOK_RAD_PER_PX, pitch: -dy * LOOK_RAD_PER_PX };
}

function el(tag, id, parent, text) {
  const e = document.createElement(tag);
  if (id) e.id = id;
  if (text) e.textContent = text;
  parent.appendChild(e);
  return e;
}

export class TouchControls {
  constructor(game) {
    this.game = game;
    this.contacts = new Map(); // contact key -> { role, x, y }
    this.stickKey = null;
    this.stickOrigin = { x: 0, y: 0 };
    this.fireKeys = new Set();
    this.lastPress = {}; // button role -> performance.now() of the last touch / pointer press

    this.root = el('div', 'touch-ui', document.body);
    this.root.classList.add('hidden');
    this.joystick = el('div', 'joystick', this.root);
    this.base = el('div', 'joy-base', this.joystick);
    this.knob = el('div', 'joy-knob', this.joystick);
    this.fireBtn = el('div', 'touch-fire', this.root, 'FIRE');
    this.reloadBtn = el('div', 'touch-reload', this.root, 'R');
    this.switchBtn = el('div', 'touch-switch', this.root, '⇄');
    this.fireBtn.dataset.touch = 'fire';
    this.reloadBtn.dataset.touch = 'reload';
    this.switchBtn.dataset.touch = 'switch';
    for (const b of [this.fireBtn, this.reloadBtn, this.switchBtn]) b.classList.add('touch-btn');
    this.hint = el('div', 'rotate-hint', document.body, 'Rotate for best play');
    this.hideStick();
    this.bind();
  }

  get stickActive() {
    return this.stickKey !== null;
  }

  setVisible(visible) {
    this.root.classList.toggle('hidden', !visible);
    if (!visible) this.releaseAll();
  }

  bind() {
    const opts = { passive: false };
    const each = (fn) => (e) => {
      if (this.game.state !== 'playing') return; // overlays get their normal tap / click
      e.preventDefault(); // no scroll, no zoom, no compat mouse events
      for (const t of e.changedTouches) fn('t' + t.identifier, t.clientX, t.clientY, t.target);
    };
    document.addEventListener('touchstart', each((k, x, y, target) => this.begin(k, x, y, target)), opts);
    document.addEventListener('touchmove', each((k, x, y) => this.move(k, x, y)), opts);
    document.addEventListener('touchend', each((k) => this.end(k)), opts);
    document.addEventListener('touchcancel', each((k) => this.end(k)), opts);
    // Gesture events (iOS Safari pinch) are also blocked.
    document.addEventListener('gesturestart', (e) => e.preventDefault(), opts);

    // Mouse and pen (for testing with ?mobile=1 on a desktop). Touch pointers come through
    // the touch events above, so they are skipped here.
    const pointer = (fn) => (e) => {
      if (e.pointerType === 'touch' || this.game.state !== 'playing') return;
      fn('p' + e.pointerId, e.clientX, e.clientY, e.target);
    };
    document.addEventListener('pointerdown', pointer((k, x, y, target) => this.begin(k, x, y, target)));
    document.addEventListener('pointermove', pointer((k, x, y) => this.move(k, x, y)));
    document.addEventListener('pointerup', pointer((k) => this.end(k)));
    document.addEventListener('pointercancel', pointer((k) => this.end(k)));
    window.addEventListener('blur', () => this.releaseAll());

    // A plain click with no press before it (keyboard, accessibility tools, scripted clicks)
    // acts as one tap. After a real press the click is ignored, so a tap never acts twice.
    for (const b of [this.fireBtn, this.reloadBtn, this.switchBtn]) {
      b.addEventListener('click', () => {
        const role = b.dataset.touch;
        if (this.game.state !== 'playing' || performance.now() - (this.lastPress[role] || -1e9) < 1000) return;
        this.tap(role);
      });
    }
  }

  // One tap on a button: fire = one press (click rules), reload, or next weapon.
  tap(role) {
    const game = this.game;
    if (role === 'fire') game.input.pressedAt = game.time;
    else if (role === 'reload') game.reload();
    else if (role === 'switch') game.selectWeapon((game.weaponIndex + 1) % WEAPONS.length);
  }

  begin(key, x, y, target) {
    if (this.contacts.has(key)) this.end(key);
    const game = this.game;
    const button = target && target.closest ? target.closest('[data-touch]') : null;
    let role = button ? button.dataset.touch : x < window.innerWidth / 2 ? 'stick' : 'look';
    if (role === 'stick' && this.stickKey !== null) role = 'look';
    this.contacts.set(key, { role, x, y });
    if (button) this.lastPress[role] = performance.now();

    if (role === 'stick') {
      this.stickKey = key;
      this.stickOrigin = { x, y };
      this.joystick.style.display = 'block';
      this.joystick.style.left = `${x}px`;
      this.joystick.style.top = `${y}px`;
      this.setStick(0, 0);
    } else if (role === 'fire') {
      this.fireKeys.add(key);
      this.fireBtn.classList.add('pressed');
      game.input.held = true;
      game.input.pressedAt = game.time;
    } else if (role === 'reload') {
      this.reloadBtn.classList.add('pressed');
      this.tap('reload');
    } else if (role === 'switch') {
      this.switchBtn.classList.add('pressed');
      this.tap('switch');
    }
  }

  move(key, x, y) {
    const c = this.contacts.get(key);
    if (!c) return;
    if (c.role === 'stick') {
      this.setStick(x - this.stickOrigin.x, y - this.stickOrigin.y);
    } else if (c.role === 'look' || c.role === 'fire') {
      const d = lookDelta(x - c.x, y - c.y);
      this.game.turn(d.yaw, d.pitch);
    }
    c.x = x;
    c.y = y;
  }

  end(key) {
    const c = this.contacts.get(key);
    if (!c) return;
    this.contacts.delete(key);
    if (c.role === 'stick') {
      this.stickKey = null;
      this.hideStick();
    } else if (c.role === 'fire') {
      this.fireKeys.delete(key);
      if (this.fireKeys.size === 0) {
        this.game.input.held = false;
        this.fireBtn.classList.remove('pressed');
      }
    } else if (c.role === 'reload') {
      this.reloadBtn.classList.remove('pressed');
    } else if (c.role === 'switch') {
      this.switchBtn.classList.remove('pressed');
    }
  }

  releaseAll() {
    for (const key of [...this.contacts.keys()]) this.end(key);
  }

  setStick(dx, dy) {
    const v = stickVector(dx, dy);
    this.knob.style.transform = `translate(${v.knobX}px, ${v.knobY}px)`;
    this.game.input.stick = v.amount > 0 ? v : null;
  }

  hideStick() {
    this.joystick.style.display = 'none';
    this.game.input.stick = null;
  }
}
