import * as THREE from 'three';

// First-person weapon models, built from boxes. They live in their own scene,
// drawn on top of the world with a camera that sits at the origin.

const lambert = (color) => new THREE.MeshLambertMaterial({ color });
const MAT = {
  dark: lambert(0x25272b),
  metal: lambert(0x3d4148),
  light: lambert(0x666b73),
  wood: lambert(0x6b4a2b),
  sleeve: lambert(0x3b4a3a),
  skin: lambert(0xc49a74),
  blade: lambert(0xd5dae2),
  flash: new THREE.MeshBasicMaterial({ color: 0xffd25e }),
  flashCore: new THREE.MeshBasicMaterial({ color: 0xfff6d0 }),
};

function part(parent, w, h, d, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  parent.add(mesh);
  return mesh;
}

function makeFlash(z) {
  const flash = new THREE.Group();
  part(flash, 0.07, 0.07, 0.05, MAT.flash, 0, 0, 0);
  part(flash, 0.03, 0.03, 0.06, MAT.flashCore, 0, 0, 0);
  part(flash, 0.16, 0.012, 0.012, MAT.flash, 0, 0, 0);
  part(flash, 0.012, 0.16, 0.012, MAT.flash, 0, 0, 0);
  flash.position.set(0, 0.02, z);
  flash.visible = false;
  return flash;
}

function buildRifle() {
  const g = new THREE.Group();
  part(g, 0.065, 0.085, 0.42, MAT.metal, 0, 0, -0.1); // receiver
  part(g, 0.07, 0.07, 0.22, MAT.dark, 0, -0.005, -0.38); // handguard
  part(g, 0.025, 0.025, 0.2, MAT.dark, 0, 0.012, -0.58); // barrel
  part(g, 0.02, 0.05, 0.02, MAT.dark, 0, 0.045, -0.64); // front sight
  part(g, 0.03, 0.025, 0.04, MAT.dark, 0, 0.055, 0.04); // rear sight
  part(g, 0.05, 0.15, 0.07, MAT.dark, 0, -0.11, -0.12, 0.2); // magazine
  part(g, 0.05, 0.1, 0.06, MAT.dark, 0, -0.08, 0.1, -0.3); // grip
  part(g, 0.055, 0.1, 0.22, MAT.wood, 0, -0.02, 0.3); // stock
  part(g, 0.1, 0.09, 0.4, MAT.sleeve, 0.04, -0.1, 0.32, 0.25, 0, 0.1); // forearm sleeve
  part(g, 0.085, 0.07, 0.12, MAT.skin, 0, -0.07, -0.34); // hand on handguard
  const flash = makeFlash(-0.72);
  g.add(flash);
  g.scale.setScalar(0.72);
  return { group: g, flash, rest: { x: 0.2, y: -0.2, z: -0.5 }, restRotY: 0.07, kick: { z: 0.035, rx: 0.045 } };
}

function buildPistol() {
  const g = new THREE.Group();
  part(g, 0.05, 0.055, 0.22, MAT.light, 0, 0.03, -0.1); // slide
  part(g, 0.045, 0.035, 0.18, MAT.metal, 0, -0.01, -0.09); // frame
  part(g, 0.02, 0.02, 0.05, MAT.dark, 0, 0.032, -0.23); // muzzle
  part(g, 0.015, 0.015, 0.015, MAT.dark, 0, 0.065, -0.18); // front sight
  part(g, 0.025, 0.015, 0.02, MAT.dark, 0, 0.065, -0.0); // rear sight
  part(g, 0.045, 0.13, 0.06, MAT.dark, 0, -0.08, 0.02, 0.22); // grip
  part(g, 0.02, 0.02, 0.05, MAT.dark, 0, -0.025, -0.05); // trigger guard
  part(g, 0.09, 0.08, 0.32, MAT.sleeve, 0.02, -0.12, 0.28, 0.35, 0, 0.05); // sleeve
  part(g, 0.075, 0.09, 0.09, MAT.skin, 0, -0.09, 0.03); // hand
  const flash = makeFlash(-0.28);
  g.add(flash);
  g.scale.setScalar(0.8);
  return { group: g, flash, rest: { x: 0.17, y: -0.17, z: -0.44 }, restRotY: 0.05, kick: { z: 0.07, rx: 0.16 } };
}

function buildKnife() {
  const g = new THREE.Group();
  part(g, 0.032, 0.032, 0.14, MAT.dark, 0, 0, 0); // handle
  part(g, 0.075, 0.018, 0.02, MAT.metal, 0, 0, -0.08); // guard
  part(g, 0.012, 0.05, 0.26, MAT.blade, 0, 0.012, -0.22); // blade
  part(g, 0.012, 0.02, 0.1, MAT.blade, 0, 0.045, -0.3, 0.1); // spine bevel
  part(g, 0.08, 0.08, 0.34, MAT.sleeve, 0.01, -0.06, 0.2, 0.3); // sleeve
  part(g, 0.06, 0.06, 0.07, MAT.skin, 0, 0, 0.0); // fist
  g.rotation.x = 0.55;
  return { group: g, flash: null, rest: { x: 0.24, y: -0.22, z: -0.4 }, restRotX: 0.55, kick: { z: 0, rx: 0 } };
}

const smooth = (t) => t * t * (3 - 2 * t);

export class WeaponView {
  constructor(scene) {
    scene.add(new THREE.AmbientLight(0xffffff, 1.0));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(-1, 2, 1.5);
    scene.add(key);

    this.models = [buildRifle(), buildPistol(), buildKnife()];
    for (const m of this.models) {
      m.group.visible = false;
      scene.add(m.group);
    }
    this.index = 0;
    this.kick = 0;
    this.raise = 0;
    this.flashUntil = 0;
    this.swing = 1; // 0..1 knife swing progress; 1 = finished
    this.bob = 0;
    this.clock = 0;
    this.setWeapon(0);
  }

  setWeapon(i) {
    this.index = i;
    this.models.forEach((m, k) => (m.group.visible = k === i));
    this.raise = 1;
    this.kick = 0;
    this.swing = 1;
    this.flashUntil = 0;
  }

  onFire(melee) {
    if (melee) {
      this.swing = 0;
    } else {
      this.kick = Math.min(1.6, this.kick + 1);
      this.flashUntil = this.clock + 0.055;
    }
  }

  // moveAmount: 0..1.6 (1 = walking, 1.6 = sprinting). reload: 0..1 or -1 when not reloading.
  update(dt, moveAmount, reload) {
    this.clock += dt;
    const m = this.models[this.index];
    const g = m.group;

    this.kick *= Math.exp(-dt * 16);
    this.raise *= Math.exp(-dt * 11);
    this.bob += dt * moveAmount * 9;

    const bobX = Math.sin(this.bob) * 0.008 * moveAmount;
    const bobY = Math.abs(Math.cos(this.bob)) * 0.01 * moveAmount;
    let x = m.rest.x + bobX;
    let y = m.rest.y + bobY - this.raise * 0.3;
    let z = m.rest.z + this.kick * m.kick.z;
    let rx = (m.restRotX || 0) + this.kick * m.kick.rx;
    let ry = m.restRotY || 0;
    let rz = 0;

    if (reload >= 0) {
      const dip = Math.sin(Math.PI * Math.min(1, reload));
      y -= dip * 0.14;
      rx += dip * 0.55;
      rz += dip * 0.35;
      x -= dip * 0.05;
    }

    if (m.flash) m.flash.visible = this.clock < this.flashUntil;

    if (this.index === 2 && this.swing < 1) {
      this.swing = Math.min(1, this.swing + dt / 0.3);
      const t = this.swing;
      let p;
      if (t < 0.25) p = -smooth(t / 0.25) * 0.4; // wind up
      else if (t < 0.6) p = -0.4 + smooth((t - 0.25) / 0.35) * 1.4; // slash
      else p = 1 - smooth((t - 0.6) / 0.4); // recover
      x -= p * 0.2;
      y -= p * 0.04 - (t < 0.25 ? 0.06 * (t / 0.25) : 0);
      z -= p * 0.12;
      rx += -p * 1.0;
      ry += p * 0.9;
      rz += p * 0.5;
    }

    g.position.set(x, y, z);
    g.rotation.set(rx, ry, rz);
  }
}
