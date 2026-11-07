import * as THREE from 'three';
import { COLORS, ZOMBIE } from './config.js';

const FORWARD_ARMS = -1.45; // arm pitch: reaching forward

// One shared set of geometries and materials for every zombie.
function buildShared() {
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  return {
    geo: {
      torso: box(0.62, 0.75, 0.34),
      head: box(0.42, 0.42, 0.42),
      arm: box(0.17, 0.7, 0.17),
      leg: box(0.25, 0.8, 0.27),
      eye: box(0.075, 0.06, 0.03),
    },
    mat: {
      skin: new THREE.MeshLambertMaterial({ color: COLORS.zombieSkin }),
      shirt: new THREE.MeshLambertMaterial({ color: COLORS.zombieShirt }),
      pants: new THREE.MeshLambertMaterial({ color: COLORS.zombiePants }),
      eye: new THREE.MeshBasicMaterial({ color: 0xff3b2f }),
    },
    flash: new THREE.MeshLambertMaterial({ color: 0xff2a2a, emissive: 0xaa0000 }),
  };
}

const easeOut = (t) => 1 - (1 - t) * (1 - t);

export class ZombieManager {
  constructor(scene) {
    this.scene = scene;
    this.shared = buildShared();
    this.list = [];
  }

  makeZombie(x, z, speed) {
    const { geo, mat } = this.shared;
    const group = new THREE.Group();
    const rig = new THREE.Group();
    group.add(rig);
    const meshes = [];
    const add = (parent, g, m, px, py, pz) => {
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(px, py, pz);
      mesh.userData.base = m;
      parent.add(mesh);
      meshes.push(mesh);
      return mesh;
    };
    const pivot = (px, py) => {
      const p = new THREE.Group();
      p.position.set(px, py, 0);
      rig.add(p);
      return p;
    };

    add(rig, geo.torso, mat.shirt, 0, 1.175, 0);
    add(rig, geo.head, mat.skin, 0, 1.76, 0);
    add(rig, geo.eye, mat.eye, -0.1, 1.79, 0.215);
    add(rig, geo.eye, mat.eye, 0.1, 1.79, 0.215);
    const legL = pivot(-0.16, 0.8);
    const legR = pivot(0.16, 0.8);
    add(legL, geo.leg, mat.pants, 0, -0.4, 0);
    add(legR, geo.leg, mat.pants, 0, -0.4, 0);
    const armL = pivot(-0.4, 1.5);
    const armR = pivot(0.4, 1.5);
    add(armL, geo.arm, mat.skin, 0, -0.33, 0);
    add(armR, geo.arm, mat.skin, 0, -0.33, 0);

    this.scene.add(group);
    const zombie = {
      group,
      rig,
      legL,
      legR,
      armL,
      armR,
      meshes,
      hp: ZOMBIE.hp,
      speed,
      x,
      z,
      yaw: 0,
      state: 'alive',
      diedAt: 0,
      flashUntil: 0,
      lastAttack: -Infinity,
      attackUntil: 0,
      phase: Math.random() * 6,
      fadeMats: null,
      matMode: 'base',
    };
    this.pose(zombie, 0);
    return zombie;
  }

  spawn(x, z, speed) {
    const zombie = this.makeZombie(x, z, speed);
    this.list.push(zombie);
    return zombie;
  }

  aliveCount() {
    let n = 0;
    for (const z of this.list) if (z.state === 'alive') n++;
    return n;
  }

  clear() {
    for (const z of this.list) this.dispose(z);
    this.list.length = 0;
  }

  dispose(z) {
    this.scene.remove(z.group);
    if (z.fadeMats) for (const m of z.fadeMats.values()) m.dispose();
    z.fadeMats = null;
  }

  // Returns true if this hit killed the zombie.
  damage(z, amount, now) {
    if (z.state !== 'alive') return false;
    z.hp -= amount;
    z.flashUntil = now + ZOMBIE.hitFlashMs;
    if (z.hp <= 0) {
      z.hp = 0;
      z.state = 'dying';
      z.diedAt = now;
      return true;
    }
    return false;
  }

  // active: false while the player is dead or the menu is shown (zombies stand still).
  update(dt, now, player, arena, active, onPlayerHit) {
    const list = this.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const z = list[i];
      if (z.state === 'dying') {
        if (now - z.diedAt >= ZOMBIE.fadeStartMs + ZOMBIE.fadeMs) {
          this.dispose(z);
          list.splice(i, 1);
          continue;
        }
      } else if (active) {
        this.think(z, dt, now, player, arena, onPlayerHit);
      }
    }
    if (active) this.separate(arena);
    for (const z of list) this.pose(z, dt, now);
  }

  think(z, dt, now, player, arena, onPlayerHit) {
    const dx = player.x - z.x;
    const dz = player.z - z.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 1e-6) z.yaw = Math.atan2(dx, dz);
    z.moving = false;
    if (dist > ZOMBIE.stopDistance && z.speed > 0) {
      const step = Math.min(z.speed * dt, dist - ZOMBIE.stopDistance);
      z.x += (dx / dist) * step;
      z.z += (dz / dist) * step;
      arena.resolve(z, ZOMBIE.radius);
      z.phase += dt * z.speed * 2.6;
      z.moving = true;
    }
    if (dist <= ZOMBIE.attackRange && now - z.lastAttack >= ZOMBIE.attackCooldownMs) {
      z.lastAttack = now;
      z.attackUntil = now + 350;
      onPlayerHit(ZOMBIE.damage);
    }
  }

  separate(arena) {
    const list = this.list;
    const min = ZOMBIE.radius * 1.8;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.state !== 'alive') continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.state !== 'alive') continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 0.001;
        const push = (min - d) / 2 / d;
        const px = dx === 0 && dz === 0 ? 0.001 : dx * push;
        const pz = dx === 0 && dz === 0 ? 0 : dz * push;
        a.x -= px;
        a.z -= pz;
        b.x += px;
        b.z += pz;
        arena.resolve(a, ZOMBIE.radius);
        arena.resolve(b, ZOMBIE.radius);
      }
    }
  }

  setMaterials(z, mode) {
    if (z.matMode === mode) return;
    z.matMode = mode;
    for (const mesh of z.meshes) {
      const base = mesh.userData.base;
      if (mode === 'flash') mesh.material = this.shared.flash;
      else if (mode === 'fade') mesh.material = z.fadeMats.get(base);
      else mesh.material = base;
    }
  }

  ensureFadeMaterials(z) {
    if (z.fadeMats) return;
    z.fadeMats = new Map();
    for (const mesh of z.meshes) {
      const base = mesh.userData.base;
      if (z.fadeMats.has(base)) continue;
      const m = base.clone();
      m.transparent = true;
      z.fadeMats.set(base, m);
    }
  }

  pose(z, dt, now = 0) {
    z.group.position.set(z.x, 0, z.z);
    z.group.rotation.y = z.yaw;

    let mode = 'base';
    if (z.state === 'dying') {
      const t = now - z.diedAt;
      z.group.rotation.x = (Math.PI / 2) * easeOut(Math.min(1, t / ZOMBIE.fallMs));
      z.rig.position.y = 0;
      const fadeT = (t - ZOMBIE.fadeStartMs) / ZOMBIE.fadeMs;
      if (fadeT > 0) {
        this.ensureFadeMaterials(z);
        for (const m of z.fadeMats.values()) m.opacity = Math.max(0, 1 - fadeT);
        mode = 'fade';
      }
      z.armL.rotation.x = z.armR.rotation.x = FORWARD_ARMS;
    } else {
      z.group.rotation.x = 0;
      const swing = z.moving ? Math.sin(z.phase) : 0;
      z.legL.rotation.x = swing * 0.7;
      z.legR.rotation.x = -swing * 0.7;
      z.rig.position.y = z.moving ? Math.abs(Math.sin(z.phase)) * 0.05 : 0;
      let arms = FORWARD_ARMS + Math.sin(z.phase * 0.5 + 1) * 0.12;
      if (now < z.attackUntil) {
        const p = 1 - (z.attackUntil - now) / 350;
        arms = FORWARD_ARMS + Math.sin(p * Math.PI) * 0.9;
      }
      z.armL.rotation.x = arms;
      z.armR.rotation.x = arms + 0.08;
      z.armL.rotation.z = 0.05;
      z.armR.rotation.z = -0.05;
    }
    if (now < z.flashUntil) mode = 'flash';
    if (mode !== 'base' || z.matMode !== 'base') this.setMaterials(z, mode);
  }

  // Redraw every zombie from its data (used by the screenshot scenes).
  sync(now = 0) {
    for (const z of this.list) this.pose(z, 0, now);
  }

  // Hitscan: the nearest living zombie on the ray (a vertical cylinder per zombie).
  raycast(ox, oy, oz, dx, dy, dz, maxDist, arena) {
    const R = ZOMBIE.radius + 0.08;
    const a = dx * dx + dz * dz;
    let best = null;
    let bestT = maxDist;
    if (a > 1e-8) {
      for (const z of this.list) {
        if (z.state !== 'alive') continue;
        const rx = ox - z.x;
        const rz = oz - z.z;
        const b = 2 * (rx * dx + rz * dz);
        const c = rx * rx + rz * rz - R * R;
        const disc = b * b - 4 * a * c;
        if (disc < 0) continue;
        let t = (-b - Math.sqrt(disc)) / (2 * a);
        if (c <= 0) t = 0;
        if (t < 0 || t > bestT) continue;
        const y = oy + dy * t;
        if (y < 0 || y > ZOMBIE.height) continue;
        best = z;
        bestT = t;
      }
    }
    if (best && arena.rayDistance(ox, oy, oz, dx, dy, dz, bestT) < bestT) return null;
    return best ? { zombie: best, distance: bestT } : null;
  }

  // Knife: nearest living zombie within `range` of the player and roughly in front.
  meleeTarget(px, pz, yaw, range) {
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    let best = null;
    let bestD = Infinity;
    for (const z of this.list) {
      if (z.state !== 'alive') continue;
      const dx = z.x - px;
      const dz = z.z - pz;
      const d = Math.hypot(dx, dz);
      if (d > range) continue;
      if (d > 0.6 && (dx * fx + dz * fz) / d < 0.7) continue; // outside ~45 degrees
      if (d < bestD) {
        bestD = d;
        best = z;
      }
    }
    return best ? { zombie: best, distance: bestD } : null;
  }
}
