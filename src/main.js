import { Game } from './game.js';

// Collect page errors so the self-test page can report them.
window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => window.__errors.push(String(e.reason)));
const origError = console.error;
console.error = (...args) => {
  window.__errors.push(args.map(String).join(' '));
  origError.apply(console, args);
};

const game = new Game(document.getElementById('game'));
window.__game = game;

const params = new URLSearchParams(location.search);
if (params.has('selftest')) {
  game.manual = true;
  import('./selftest.js').then((m) => m.run(game));
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
