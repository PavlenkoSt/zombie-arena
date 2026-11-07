# ZOMBIE ARENA

A small first-person browser game: survive waves of zombies in a walled arena.
Plain static site. Three.js 0.160.0 loads from a CDN through an import map. All art is boxes and flat colours.

## Run

    npm run dev      # serves the project at http://localhost:5173
    npm test         # unit tests for the rules and the weapon logic (Node, no browser)

## Controls

WASD move, Shift sprint, mouse look, left click attack, 1/2/3 or mouse wheel switch weapon, R reload.

## Layout

- `index.html`, `src/style.css` – page, HUD and overlays
- `src/config.js` – every tunable number (weapons, zombies, waves, arena)
- `src/rules.js`, `src/weaponState.js` – pure logic (tested in `src/rules.test.js`)
- `src/game.js` – main loop, input, waves, player; `src/arena.js`, `src/zombies.js`, `src/weaponView.js`, `src/hud.js`

## Browser checks

- `/?selftest` runs the real game code with fixed time steps and prints PASS / FAIL lines.
- `/?shot=start-screen|gameplay-rifle|knife|wave-banner|game-over` opens a fixed scene for screenshots.

## Milestone 2 (not done yet)

Sounds, pickups / health, more zombie types.
