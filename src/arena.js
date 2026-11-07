import * as THREE from 'three';
import { ARENA, COLORS, CRATES, FOG } from './config.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export class Arena {
  constructor(scene) {
    this.boxes = []; // collision boxes: { minX, maxX, minZ, maxZ, top }
    scene.background = new THREE.Color(COLORS.sky);
    scene.fog = new THREE.Fog(COLORS.fog, FOG.near, FOG.far);

    scene.add(new THREE.HemisphereLight(0xc4ccdc, 0x4a4d3c, 2.4));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-12, 25, 8);
    scene.add(sun);

    this.buildGround(scene);
    this.buildWalls(scene);
    this.buildCrates(scene);
  }

  buildGround(scene) {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(ARENA.size, ARENA.size),
      new THREE.MeshLambertMaterial({ color: COLORS.ground }),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const grid = new THREE.GridHelper(ARENA.size, 30, 0x2f3325, 0x2f3325);
    grid.position.y = 0.01;
    scene.add(grid);
  }

  buildWalls(scene) {
    const mat = new THREE.MeshLambertMaterial({ color: COLORS.wall });
    const len = ARENA.size + ARENA.wallThickness * 2;
    const t = ARENA.wallThickness;
    const h = ARENA.wallHeight;
    const off = ARENA.half + t / 2;
    const defs = [
      [len, t, 0, -off],
      [len, t, 0, off],
      [t, len, -off, 0],
      [t, len, off, 0],
    ];
    for (const [w, d, x, z] of defs) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      wall.position.set(x, h / 2, z);
      scene.add(wall);
    }
    // Lighter cap strip so the wall top reads against the dark sky.
    const capMat = new THREE.MeshLambertMaterial({ color: 0x6a6a6a });
    for (const [w, d, x, z] of defs) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w, 0.15, d), capMat);
      cap.position.set(x, h + 0.075, z);
      scene.add(cap);
    }
  }

  buildCrates(scene) {
    const mat = new THREE.MeshLambertMaterial({ color: COLORS.crate });
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x35250f });
    for (const c of CRATES) {
      const y = c.y ?? 0;
      const geo = new THREE.BoxGeometry(c.w, c.h, c.d);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(c.x, y + c.h / 2, c.z);
      scene.add(mesh);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat);
      edges.position.copy(mesh.position);
      scene.add(edges);
      if (y === 0) {
        this.boxes.push({
          minX: c.x - c.w / 2,
          maxX: c.x + c.w / 2,
          minZ: c.z - c.d / 2,
          maxZ: c.z + c.d / 2,
          top: c.h,
        });
      }
    }
  }

  // Move a circle (pos.x, pos.z, radius r) out of the crates and inside the walls.
  resolve(pos, r) {
    const lim = ARENA.half - r;
    pos.x = clamp(pos.x, -lim, lim);
    pos.z = clamp(pos.z, -lim, lim);
    for (const b of this.boxes) {
      const cx = clamp(pos.x, b.minX, b.maxX);
      const cz = clamp(pos.z, b.minZ, b.maxZ);
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        const push = (r - d) / d;
        pos.x += dx * push;
        pos.z += dz * push;
      } else {
        // Centre is inside the box: leave by the nearest side.
        const l = pos.x - b.minX;
        const rr = b.maxX - pos.x;
        const f = pos.z - b.minZ;
        const bk = b.maxZ - pos.z;
        const m = Math.min(l, rr, f, bk);
        if (m === l) pos.x = b.minX - r;
        else if (m === rr) pos.x = b.maxX + r;
        else if (m === f) pos.z = b.minZ - r;
        else pos.z = b.maxZ + r;
      }
    }
    pos.x = clamp(pos.x, -lim, lim);
    pos.z = clamp(pos.z, -lim, lim);
  }

  // Distance along a ray to the first crate, or Infinity.
  rayDistance(ox, oy, oz, dx, dy, dz, maxDist) {
    let best = Infinity;
    for (const b of this.boxes) {
      let t0 = 0;
      let t1 = maxDist;
      const slabs = [
        [ox, dx, b.minX, b.maxX],
        [oy, dy, 0, b.top],
        [oz, dz, b.minZ, b.maxZ],
      ];
      let hit = true;
      for (const [o, d, lo, hi] of slabs) {
        if (Math.abs(d) < 1e-9) {
          if (o < lo || o > hi) {
            hit = false;
            break;
          }
        } else {
          let a = (lo - o) / d;
          let c = (hi - o) / d;
          if (a > c) [a, c] = [c, a];
          t0 = Math.max(t0, a);
          t1 = Math.min(t1, c);
          if (t0 > t1) {
            hit = false;
            break;
          }
        }
      }
      if (hit && t0 < best) best = t0;
    }
    return best;
  }

  // Random point just inside one of the four walls, away from (px, pz).
  randomWallPoint(rand, px, pz, minDistance) {
    const inset = 1.2;
    const edge = ARENA.half - inset;
    let x = 0;
    let z = 0;
    for (let i = 0; i < 12; i++) {
      const side = Math.floor(rand() * 4);
      const u = (rand() * 2 - 1) * edge;
      if (side === 0) [x, z] = [u, -edge];
      else if (side === 1) [x, z] = [u, edge];
      else if (side === 2) [x, z] = [-edge, u];
      else [x, z] = [edge, u];
      if (Math.hypot(x - px, z - pz) >= minDistance) break;
    }
    return { x, z };
  }
}
