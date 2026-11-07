import * as THREE from 'three';
import { PLAYER, WAVE, WEAPONS } from './config.js';
import { Arena } from './arena.js';
import { ZombieManager } from './zombies.js';
import { WeaponView } from './weaponView.js';
import { WeaponState } from './weaponState.js';
import { Hud } from './hud.js';
import { zombieCountForWave, zombieSpeedForWave } from './rules.js';

const FOV = 75;
const MAX_DT = 0.05;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.autoClear = false;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 120);
    this.camera.rotation.order = 'YXZ';
    this.arena = new Arena(this.scene);
    this.zombies = new ZombieManager(this.scene);

    this.weaponScene = new THREE.Scene();
    this.viewCamera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 10);
    this.view = new WeaponView(this.weaponScene);

    this.hud = new Hud();
    this.input = { keys: new Set(), held: false, pressedAt: -Infinity };
    this.rand = Math.random;
    this.manual = false; // true: the loop only draws (self-test and screenshot scenes drive update())
    this.autoWaves = true;
    this.state = 'menu'; // menu | playing | paused | dead
    this.hadLock = false;
    this.menuAngle = 0;
    this.diedAtReal = 0;
    this.lastWheel = 0;
    this.onShot = null; // optional hook: (weaponDef, time) => void
    this.shots = 0;

    this.resetWorld();
    this.bindEvents();
    this.resize();
    this.spawnMenuZombies();
    this.hud.showStart(true);
    this.hud.show(false);
  }

  // ---------- state ----------

  resetWorld() {
    this.player = { x: 0, z: 0, yaw: 0, pitch: 0, hp: PLAYER.maxHp, moveAmount: 0 };
    this.clockMs = 0; // exact sum of frame steps
    this.time = 0; // game time in integer ms, used by all game rules
    this.kills = 0;
    this.wave = 0;
    this.nextWaveAt = null;
    this.bannerUntil = 0;
    this.damageFlash = 0;
    this.shots = 0;
    this.weapons = WEAPONS.map((d) => new WeaponState(d));
    this.weaponIndex = 0;
    this.view.setWeapon(0);
    this.input.held = false;
    this.input.pressedAt = -Infinity;
    this.input.keys.clear();
    this.zombies.clear();
    this.hud.hideBanner();
  }

  get weapon() {
    return this.weapons[this.weaponIndex];
  }

  spawnMenuZombies() {
    const spots = [[-4, -9], [3, -12], [-10, 2], [9, 5], [-2, 10], [14, -6], [-14, -10]];
    for (const [x, z] of spots) {
      const zombie = this.zombies.spawn(x, z, 0);
      zombie.yaw = Math.atan2(-x, -z);
    }
    this.zombies.sync();
  }

  start({ lock = true, wave = 1 } = {}) {
    this.resetWorld();
    this.state = 'playing';
    this.hud.showStart(false);
    this.hud.showGameOver(false);
    this.hud.show(true);
    this.startWave(wave);
    this.updateVisuals(0);
    if (lock) this.requestLock();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.held = false;
    this.input.keys.clear();
    this.hud.showStart(true, 'Paused — click to resume');
  }

  resume() {
    this.state = 'playing';
    this.hud.showStart(false);
    this.requestLock();
  }

  die() {
    this.state = 'dead';
    this.diedAtReal = performance.now();
    this.input.held = false;
    this.input.keys.clear();
    this.hadLock = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.hud.hideBanner();
    this.hud.showGameOver(true, this.wave, this.kills);
  }

  requestLock() {
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) {
      /* pointer lock not available: the game still runs */
    }
  }

  startWave(n) {
    this.wave = n;
    this.nextWaveAt = null;
    const count = zombieCountForWave(n);
    const speed = zombieSpeedForWave(n);
    for (let i = 0; i < count; i++) {
      const p = this.arena.randomWallPoint(this.rand, this.player.x, this.player.z, WAVE.minSpawnDistance);
      this.zombies.spawn(p.x, p.z, speed);
    }
    this.bannerUntil = this.time + WAVE.bannerMs;
    this.hud.showBanner(`WAVE ${n}`);
  }

  hurtPlayer(amount) {
    if (this.state !== 'playing') return;
    this.player.hp = Math.max(0, this.player.hp - amount);
    this.damageFlash = 0.55;
    if (this.player.hp <= 0) this.die();
  }

  // ---------- input ----------

  bindEvents() {
    const input = this.input;
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('blur', () => {
      input.held = false;
      input.keys.clear();
    });

    document.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      input.keys.add(e.code);
      if (this.state !== 'playing') return;
      if (e.code === 'Digit1' || e.code === 'Numpad1') this.selectWeapon(0);
      else if (e.code === 'Digit2' || e.code === 'Numpad2') this.selectWeapon(1);
      else if (e.code === 'Digit3' || e.code === 'Numpad3') this.selectWeapon(2);
      else if (e.code === 'KeyR') this.reload();
    });
    document.addEventListener('keyup', (e) => input.keys.delete(e.code));

    document.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || this.state !== 'playing') return;
      input.held = true;
      input.pressedAt = this.time;
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) input.held = false;
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('mousemove', (e) => {
      if (this.state !== 'playing' || document.pointerLockElement !== this.canvas) return;
      if (Math.abs(e.movementX) > 300 || Math.abs(e.movementY) > 300) return; // browser glitch
      this.player.yaw -= e.movementX * PLAYER.mouseSensitivity;
      this.player.pitch -= e.movementY * PLAYER.mouseSensitivity;
      this.player.pitch = Math.max(-1.45, Math.min(1.45, this.player.pitch));
    });

    document.addEventListener(
      'wheel',
      (e) => {
        if (this.state !== 'playing') return;
        const now = performance.now();
        if (now - this.lastWheel < 120 || e.deltaY === 0) return;
        this.lastWheel = now;
        const n = WEAPONS.length;
        this.selectWeapon((this.weaponIndex + (e.deltaY > 0 ? 1 : n - 1)) % n);
      },
      { passive: true },
    );

    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === this.canvas) {
        this.hadLock = true;
      } else if (this.hadLock) {
        this.hadLock = false;
        this.pause();
      }
    });

    this.hud.startScreen.addEventListener('click', () => {
      if (this.state === 'menu') this.start();
      else if (this.state === 'paused') this.resume();
    });
    this.hud.gameOver.addEventListener('click', () => {
      if (this.state === 'dead' && performance.now() - this.diedAtReal > 600) this.start();
    });
  }

  selectWeapon(i) {
    if (i === this.weaponIndex || i < 0 || i >= this.weapons.length) return;
    this.weapon.cancelReload();
    this.weaponIndex = i;
    this.view.setWeapon(i);
  }

  reload() {
    this.weapon.startReload(this.time);
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.viewCamera.aspect = w / h;
    this.viewCamera.updateProjectionMatrix();
  }

  // ---------- simulation ----------

  update(dt) {
    dt = Math.min(dt, MAX_DT);
    const playing = this.state === 'playing';
    if (playing) {
      // Integer ms: six 1000/60 ms frames give exactly 100 ms, not 99.99999999999977.
      this.clockMs += dt * 1000;
      this.time = Math.round(this.clockMs);
      this.updatePlayer(dt);
      const ws = this.weapon;
      ws.update(this.time);
      if (ws.tryFire(this.time, this.input)) this.fire();
    }
    this.zombies.update(dt, this.time, this.player, this.arena, playing, (d) => this.hurtPlayer(d));
    if (playing) this.updateWaves();
    this.updateVisuals(dt);
  }

  updatePlayer(dt) {
    const p = this.player;
    const k = this.input.keys;
    let f = 0;
    let r = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) f += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) f -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) r += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) r -= 1;
    const len = Math.hypot(f, r);
    p.moveAmount = 0;
    if (len > 0) {
      const sprint = k.has('ShiftLeft') || k.has('ShiftRight');
      const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
      const sin = Math.sin(p.yaw);
      const cos = Math.cos(p.yaw);
      const fx = -sin;
      const fz = -cos;
      const rx = cos;
      const rz = -sin;
      p.x += ((fx * f + rx * r) / len) * speed * dt;
      p.z += ((fz * f + rz * r) / len) * speed * dt;
      p.moveAmount = sprint ? 1.6 : 1;
    }
    this.arena.resolve(p, PLAYER.radius);
  }

  fire() {
    const ws = this.weapon;
    const def = ws.def;
    this.view.onFire(def.melee);
    this.shots++;
    if (this.onShot) this.onShot(def, this.time);

    let target = null;
    if (def.melee) {
      target = this.zombies.meleeTarget(this.player.x, this.player.z, this.player.yaw, def.range);
    } else {
      const p = this.player;
      const cp = Math.cos(p.pitch);
      const dx = -Math.sin(p.yaw) * cp;
      const dy = Math.sin(p.pitch);
      const dz = -Math.cos(p.yaw) * cp;
      target = this.zombies.raycast(p.x, PLAYER.eyeHeight, p.z, dx, dy, dz, 100, this.arena);
    }
    if (!target) return;
    const killed = this.zombies.damage(target.zombie, def.damage, this.time);
    if (killed) this.kills++;
    this.hud.hitMarker(killed);
  }

  updateWaves() {
    if (this.time >= this.bannerUntil && this.hud.bannerVisible) this.hud.hideBanner();
    if (!this.autoWaves) return;
    if (this.nextWaveAt === null && this.wave > 0 && this.zombies.aliveCount() === 0) {
      this.nextWaveAt = this.time + WAVE.nextWaveDelayMs;
    }
    if (this.nextWaveAt !== null && this.time >= this.nextWaveAt) this.startWave(this.wave + 1);
  }

  updateVisuals(dt) {
    const p = this.player;
    const cam = this.camera;
    if (this.state === 'menu') {
      if (!this.manual) this.menuAngle += dt * 0.12;
      const a = this.menuAngle;
      cam.position.set(Math.cos(a) * 15, 3.4, Math.sin(a) * 15);
      cam.lookAt(0, 1.2, 0);
      cam.rotation.order = 'YXZ';
    } else {
      const bob = Math.sin(this.view.bob) * 0.025 * p.moveAmount;
      cam.position.set(p.x, PLAYER.eyeHeight + bob, p.z);
      cam.rotation.set(p.pitch, p.yaw, 0);
    }

    const ws = this.weapon;
    this.view.update(dt, p.moveAmount, ws.reloading ? ws.reloadProgress(this.time) : -1);
    this.damageFlash = Math.max(0, this.damageFlash - dt * 1.6);

    const hud = this.hud;
    hud.setWave(Math.max(1, this.wave));
    hud.setKills(this.kills);
    hud.setHealth(p.hp);
    hud.setWeapon(this.weaponIndex, ws.mag, ws.reloading);
    hud.setDamageFlash(this.damageFlash);
  }

  // ---------- drawing ----------

  render() {
    const r = this.renderer;
    r.clear();
    r.render(this.scene, this.camera);
    if (this.state === 'playing' || this.state === 'paused') {
      r.clearDepth();
      r.render(this.weaponScene, this.viewCamera);
    }
  }

  run() {
    let last = performance.now();
    const frame = (t) => {
      const dt = (t - last) / 1000;
      last = t;
      if (this.manual) this.updateVisuals(0);
      else this.update(dt);
      this.render();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}
