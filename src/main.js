import { Game } from './game.js';
import { detectMobile } from './touchControls.js';

// Collect page errors so the self-test page can report them.
window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => window.__errors.push(String(e.reason)));
const origError = console.error;
console.error = (...args) => {
  window.__errors.push(args.map(String).join(' '));
  origError.apply(console, args);
};

const params = new URLSearchParams(location.search);
const shot = params.get('shot') || '';
let mobile = detectMobile(params, window);
if (!params.has('mobile')) {
  // Test pages pick their own mode: mobile-* shots and ?selftest=mobile use touch, the rest desktop.
  if (shot.startsWith('mobile-') || params.get('selftest') === 'mobile') mobile = true;
  else if (shot.startsWith('desktop-') || params.has('selftest')) mobile = false;
}

const game = new Game(document.getElementById('game'), { mobile });
window.__game = game;

if (params.has('selftest')) {
  game.manual = true;
  const file = params.get('selftest') === 'mobile' ? './selftestMobile.js' : './selftest.js';
  import(file).then((m) => m.run(game));
} else if (params.has('shot')) {
  game.manual = true;
  import('./shots.js').then((m) => {
    m.setup(game, params.get('shot'));
    game.updateVisuals(0);
    game.render(); // draw now: a hidden tab gets no animation frames
  });
}
game.updateVisuals(0);
game.render();
game.run();
