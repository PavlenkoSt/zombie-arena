import { WAVE, ZOMBIE, JUMP } from './config.js';

export function zombieCountForWave(wave) {
  return WAVE.base + WAVE.perWave * wave;
}

export function zombieSpeedForWave(wave) {
  const speed = ZOMBIE.baseSpeed + ZOMBIE.speedPerWave * (wave - 1);
  return Math.min(ZOMBIE.maxSpeed, speed);
}

// Jump body: { jumpY: height above normal eye height, vy: vertical speed, onGround }.
// Starts a jump from the ground. In the air it does nothing (no double jump).
export function tryJump(body) {
  if (!body.onGround) return false;
  body.onGround = false;
  body.vy = JUMP.velocity;
  return true;
}

// One step of the jump arc. Exact for constant gravity at any frame time, so the peak
// does not depend on the frame rate. Landing puts the eye back at normal height.
export function stepJump(body, dt) {
  if (body.onGround) return;
  body.jumpY += body.vy * dt - 0.5 * JUMP.gravity * dt * dt;
  body.vy -= JUMP.gravity * dt;
  if (body.jumpY <= 0) {
    body.jumpY = 0;
    body.vy = 0;
    body.onGround = true;
  }
}

export function hitsToKill(damage, hp = ZOMBIE.hp) {
  return Math.ceil(hp / damage);
}
