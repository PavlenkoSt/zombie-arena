// All tunable game numbers live here.

export const ARENA = {
  size: 60,
  half: 30,
  wallHeight: 4,
  wallThickness: 1,
};

export const COLORS = {
  ground: 0x3a3f2e,
  wall: 0x555555,
  sky: 0x1a1d24,
  fog: 0x1a1d24,
  crate: 0x7a5a36,
  zombieSkin: 0x4f7a3a,
  zombieShirt: 0x59503f,
  zombiePants: 0x2c3140,
};

export const FOG = { near: 12, far: 50 };

export const PLAYER = {
  maxHp: 100,
  walkSpeed: 5,
  sprintSpeed: 8,
  radius: 0.4,
  eyeHeight: 1.7,
  mouseSensitivity: 0.0022,
};

export const ZOMBIE = {
  hp: 100,
  baseSpeed: 2.0,
  speedPerWave: 0.15,
  maxSpeed: 4,
  damage: 10,
  attackRange: 1.5,
  attackCooldownMs: 1000,
  radius: 0.45,
  height: 2.0,
  stopDistance: 1.0,
  hitFlashMs: 120,
  fallMs: 450,
  fadeStartMs: 1300,
  fadeMs: 700,
};

export const WAVE = {
  base: 5,
  perWave: 3,
  nextWaveDelayMs: 5000,
  bannerMs: 2000,
  minSpawnDistance: 12,
};

// intervalMs = minimum time between shots / swings.
export const WEAPONS = [
  { id: 'rifle', name: 'Rifle', key: 1, auto: true, melee: false, intervalMs: 100, damage: 15, mag: 30, reloadMs: 2000 },
  { id: 'pistol', name: 'Pistol', key: 2, auto: false, melee: false, intervalMs: 250, damage: 35, mag: 12, reloadMs: 1200 },
  { id: 'knife', name: 'Knife', key: 3, auto: true, melee: true, intervalMs: 500, damage: 60, mag: Infinity, reloadMs: 0, range: 2 },
];

// A click made up to this long before a weapon is ready still fires.
export const CLICK_BUFFER_MS = 150;

export const CRATES = [
  { x: -9, z: -8, w: 2, h: 2, d: 2 },
  { x: -9, z: -8, w: 1.2, h: 1.2, d: 1.2, y: 2 },
  { x: 11, z: -10, w: 2.4, h: 1.6, d: 2.4 },
  { x: -14, z: 11, w: 2, h: 2, d: 2 },
  { x: 8, z: 12, w: 1.6, h: 1.6, d: 3 },
  { x: 17, z: 5, w: 2, h: 2, d: 2 },
  { x: -20, z: -17, w: 2.4, h: 2.4, d: 2.4 },
  { x: 3, z: -19, w: 1.8, h: 1.8, d: 1.8 },
];
