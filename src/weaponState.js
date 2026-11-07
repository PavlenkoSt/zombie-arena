import { CLICK_BUFFER_MS } from './config.js';

// Game time is a sum of float frame steps, so six 1000/60 ms frames can add up to
// 99.99999999999977 ms. This tolerance only absorbs that rounding noise (1 microsecond).
const TIME_EPSILON_MS = 0.001;

// Ammo, reload and fire-rate logic for one weapon. No rendering here.
// All times are game milliseconds.
export class WeaponState {
  constructor(def) {
    this.def = def;
    this.mag = def.mag;
    this.lastShotAt = -Infinity;
    this.reloadEnd = null;
    this.lastConsumedPress = -Infinity;
  }

  get reloading() {
    return this.reloadEnd !== null;
  }

  canReload() {
    return !this.def.melee && this.reloadEnd === null && this.mag < this.def.mag;
  }

  startReload(now) {
    if (!this.canReload()) return false;
    this.reloadEnd = now + this.def.reloadMs;
    return true;
  }

  cancelReload() {
    this.reloadEnd = null;
  }

  reloadProgress(now) {
    if (this.reloadEnd === null) return 0;
    const start = this.reloadEnd - this.def.reloadMs;
    return Math.min(1, Math.max(0, (now - start) / this.def.reloadMs));
  }

  update(now) {
    if (this.reloadEnd !== null && now >= this.reloadEnd) {
      this.mag = this.def.mag;
      this.reloadEnd = null;
    }
    if (!this.def.melee && this.mag <= 0 && this.reloadEnd === null) {
      this.startReload(now);
    }
  }

  // Ready when at least intervalMs has passed since the actual time of the last shot.
  isReady(now) {
    return now - this.lastShotAt >= this.def.intervalMs - TIME_EPSILON_MS;
  }

  // input: { held: boolean, pressedAt: ms of the last mouse-down }
  // Returns true when a shot / swing happens now.

  tryFire(now, input) {
    const def = this.def;
    if (this.reloadEnd !== null || !this.isReady(now)) return false;
    if (!def.melee && this.mag <= 0) return false;

    const freshPress =
      input.pressedAt > this.lastConsumedPress && now - input.pressedAt <= CLICK_BUFFER_MS;
    const wants = (def.auto && input.held) || freshPress;
    if (!wants) return false;

    this.lastConsumedPress = Math.max(this.lastConsumedPress, input.pressedAt);
    this.lastShotAt = now;
    if (!def.melee) this.mag -= 1;
    return true;
  }
}
