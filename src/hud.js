import { PLAYER, WEAPONS } from './config.js';

const $ = (id) => document.getElementById(id);

// All DOM overlays. Writes to the DOM only when a value changes.
export class Hud {
  constructor() {
    this.root = $('hud');
    this.waveEl = $('wave');
    this.killsEl = $('kills');
    this.hpFill = $('hp-fill');
    this.hpText = $('hp-text');
    this.weaponName = $('weapon-name');
    this.ammoCount = $('ammo-count');
    this.reloadNote = $('reload-note');
    this.slots = [...document.querySelectorAll('#slots .slot')];
    this.flashEl = $('damage-flash');
    this.bannerEl = $('banner');
    this.crosshair = $('crosshair');
    this.startScreen = $('start-screen');
    this.startHint = $('start-hint');
    this.gameOver = $('game-over');
    this.goWave = $('go-wave');
    this.goKills = $('go-kills');
    this.cache = {};
    this.bannerVisible = false;
  }

  set(key, value, apply) {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    apply(value);
  }

  show(visible) {
    this.root.classList.toggle('hidden', !visible);
  }

  setWave(n) {
    this.set('wave', n, (v) => (this.waveEl.textContent = `Wave ${v}`));
  }

  setKills(n) {
    this.set('kills', n, (v) => (this.killsEl.textContent = `Kills ${v}`));
  }

  setHealth(hp) {
    this.set('hp', hp, (v) => {
      this.hpFill.style.width = `${(v / PLAYER.maxHp) * 100}%`;
      this.hpText.textContent = String(Math.ceil(v));
    });
  }

  setWeapon(index, mag, reloading) {
    const def = WEAPONS[index];
    this.set('weapon', def.id, () => {
      this.weaponName.textContent = def.name;
      this.slots.forEach((s, i) => s.classList.toggle('active', i === index));
    });
    const text = def.melee ? '— / ∞' : `${mag} / ∞`;
    this.set('ammo', text, (v) => (this.ammoCount.textContent = v));
    this.set('reload', reloading, (v) => (this.reloadNote.textContent = v ? 'RELOADING…' : ''));
  }

  setDamageFlash(v) {
    const rounded = Math.round(v * 50) / 50;
    this.set('flash', rounded, (x) => (this.flashEl.style.opacity = String(x)));
  }

  showBanner(text) {
    this.bannerEl.textContent = text;
    this.bannerEl.classList.add('visible');
    this.bannerVisible = true;
  }

  hideBanner() {
    this.bannerEl.classList.remove('visible');
    this.bannerVisible = false;
  }

  hitMarker(kill) {
    const c = this.crosshair;
    c.classList.remove('hit', 'kill');
    void c.offsetWidth; // restart the CSS animation
    c.classList.add(kill ? 'kill' : 'hit');
  }

  showStart(visible, hint = 'Click to play') {
    this.startHint.textContent = hint;
    this.startScreen.classList.toggle('hidden', !visible);
  }

  showGameOver(visible, wave = 1, kills = 0) {
    this.goWave.textContent = `Wave reached: ${wave}`;
    this.goKills.textContent = `Kills: ${kills}`;
    this.gameOver.classList.toggle('hidden', !visible);
  }
}
