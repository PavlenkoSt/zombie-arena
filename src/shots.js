import { mulberry32 } from './rng.js';
import { stepJump } from './rules.js';

// Fixed scenes for screenshots: open /?shot=<name>. The scene is posed once and then
// time stands still, so the picture does not change while it is taken.

function faceYaw(z, game) {
  z.yaw = Math.atan2(game.player.x - z.x, game.player.z - z.z);
}

function place(game, spots) {
  const list = game.zombies.list;
  spots.forEach(([x, z], i) => {
    const zombie = list[i];
    if (!zombie) return;
    zombie.x = x;
    zombie.z = z;
    zombie.moving = true;
    zombie.phase = i * 1.7;
    faceYaw(zombie, game);
  });
  // Park the other zombies against the far walls, out of the way.
  for (let i = spots.length; i < list.length; i++) {
    list[i].x = -28 + i * 3;
    list[i].z = 28;
    faceYaw(list[i], game);
  }
  game.zombies.sync(game.time);
}

function rifleScene(game) {
  game.start({ lock: false });
  game.hud.hideBanner();
  game.player.yaw = 0.12;
  place(game, [[-2.6, -8], [1.8, -6], [4.6, -10], [-6, -12.5], [0.2, -15], [8, -7]]);
  game.weapon.mag = 22;
  game.view.onFire(false);
  game.view.kick = 0.9;
  game.view.flashUntil = 1e9;
  game.view.raise = 0;
  game.view.update(0, 0, -1);
}

export function setup(game, name) {
  game.rand = mulberry32(11);
  game.autoWaves = false;
  document.title = `shot:${name}`;

  if (name === 'start-screen') {
    game.menuAngle = 0.5;
    return;
  }

  if (name === 'gameplay-rifle') {
    rifleScene(game);
    return;
  }

  // Touch controls (these names force mobile mode, see main.js). Open them at 844x390 or 390x844,
  // for example through src/viewport.html.
  if (name === 'mobile-landscape' || name === 'mobile-portrait') {
    rifleScene(game);
    return;
  }

  if (name === 'mobile-joystick') {
    rifleScene(game);
    // Left thumb down on the left half, pushed up and right; right thumb holds fire.
    const x = Math.round(window.innerWidth * 0.22);
    const y = Math.round(window.innerHeight - 130);
    game.touch.begin('shot-stick', x, y, game.canvas);
    game.touch.move('shot-stick', x + 26, y - 38);
    game.touch.begin('shot-fire', 0, 0, game.touch.fireBtn);
    return;
  }

  // Touch mode with the JUMP button under FIRE (open at 844x390).
  if (name === 'mobile-jump-button') {
    rifleScene(game);
    return;
  }

  // Desktop view at the top of a jump: the real jump arc, stepped to its peak.
  if (name === 'jump-midair') {
    rifleScene(game);
    const p = game.player;
    game.jump();
    while (p.vy > 0) stepJump(p, 1 / 600);
    return;
  }

  // Desktop at any size: no touch controls (this name forces desktop mode).
  if (name === 'desktop-unchanged') {
    rifleScene(game);
    return;
  }

  if (name === 'knife') {
    game.start({ lock: false });
    game.hud.hideBanner();
    game.player.yaw = 0;
    game.selectWeapon(2);
    place(game, [[0.2, -1.7], [-3, -6], [4, -8], [-6, -11]]);
    game.view.raise = 0;
    game.view.swing = 0.42;
    game.view.update(0, 0, -1);
    return;
  }

  if (name === 'wave-banner') {
    game.start({ lock: false, wave: 2 });
    game.player.yaw = 0.3;
    game.view.raise = 0;
    return;
  }

  if (name === 'game-over') {
    game.start({ lock: false, wave: 3 });
    game.kills = 14;
    game.hurtPlayer(100);
    game.damageFlash = 0;
    game.view.raise = 0;
    return;
  }

  document.body.textContent = `Unknown shot: ${name}`;
}
