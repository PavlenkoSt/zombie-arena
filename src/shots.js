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

  // Title screen with the logo. Open title-phone at 390x844 (src/viewport.html, add &mobile=1).
  if (name === 'start-screen' || name === 'title-desktop' || name === 'title-phone') {
    game.menuAngle = 0.5;
    return;
  }

  // Asset pages on a plain background: icon (128x128), logo-128 (logo at 128x64, legibility check)
  // and favicon-tab (the favicon at 32x32 in a browser-tab mock-up). A caption prints the measured CSS size.
  if (name === 'icon' || name === 'logo-128' || name === 'favicon-tab') {
    const sizes = { icon: [128, 128], 'logo-128': [128, 64], 'favicon-tab': [32, 32] };
    const [w, h] = sizes[name];
    const file = name === 'logo-128' ? 'assets/logo.svg' : 'assets/icon.svg';
    document.body.innerHTML = '';
    document.body.style.cssText =
      'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:#2a2d34;color:#ccc;font:14px/1.3 monospace';
    const img = document.createElement('img');
    img.src = file;
    img.alt = 'ZOMBIE ARENA';
    img.style.cssText = `display:block;width:${w}px;height:${h}px`;
    if (name === 'favicon-tab') {
      const tab = document.createElement('div');
      tab.style.cssText =
        'display:flex;align-items:center;gap:10px;padding:8px 14px;width:240px;background:#3c3f47;border-radius:10px 10px 0 0;color:#eee;font:15px/1 sans-serif';
      const title = document.createElement('span');
      title.textContent = 'ZOMBIE ARENA';
      tab.append(img, title);
      document.body.append(tab);
    } else {
      document.body.append(img);
    }
    const caption = document.createElement('div');
    caption.id = 'shot-size';
    document.body.append(caption);
    const measure = () => {
      const r = img.getBoundingClientRect();
      caption.textContent = `${file} at ${r.width} x ${r.height} CSS px (natural ${img.naturalWidth} x ${img.naturalHeight})`;
    };
    img.decode().then(measure, () => (caption.textContent = `${file} did not load`));
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
