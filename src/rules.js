import { WAVE, ZOMBIE } from './config.js';

export function zombieCountForWave(wave) {
  return WAVE.base + WAVE.perWave * wave;
}

export function zombieSpeedForWave(wave) {
  const speed = ZOMBIE.baseSpeed + ZOMBIE.speedPerWave * (wave - 1);
  return Math.min(ZOMBIE.maxSpeed, speed);
}

export function hitsToKill(damage, hp = ZOMBIE.hp) {
  return Math.ceil(hp / damage);
}
