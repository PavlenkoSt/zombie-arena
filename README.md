# ZOMBIE ARENA

A small first-person browser game: survive waves of zombies in a walled arena.
Plain static site. Three.js 0.160.0 loads from a CDN through an import map. All art is boxes and flat colours.

## Run

    npm run dev      # serves the project at http://localhost:5173
    npm test         # unit tests: rules, weapon logic, touch controls, logo/favicon files (Node, no browser)

## Controls

WASD move, Shift sprint, Space jump, mouse look, left click attack, 1/2/3 or mouse wheel switch weapon, R reload.
Jump: no double jump; move and aim keep working in the air (numbers in `JUMP` in `src/config.js`).

Touch (phones and tablets, detected from a coarse pointer, or forced with `?mobile=1`; `?mobile=0` forces desktop):
left thumb anywhere on the left half = floating joystick (push past 90 % to sprint), right thumb drag = look,
FIRE hold to attack (drag on it to aim), ⇄ switch weapon, R reload, JUMP (round button under FIRE) jump. No pointer lock; tap the overlay to start.

## Layout

- `index.html`, `src/style.css` – page, HUD and overlays
- `assets/logo.svg` (title-screen logo), `assets/icon.svg` (favicon) – hand-made SVG, no fonts or images
- `src/config.js` – every tunable number (weapons, zombies, waves, arena, jump)
- `src/rules.js`, `src/weaponState.js` – pure logic (tested in `src/rules.test.js`)
- `src/game.js` – main loop, input, waves, player; `src/arena.js`, `src/zombies.js`, `src/weaponView.js`, `src/hud.js`
- `src/touchControls.js` – mobile detection, joystick, touch look and touch buttons (tested in `src/touchControls.test.js`)

## Browser checks

- `/?selftest` runs the real game code with fixed time steps and prints PASS / FAIL lines.
- `/?selftest=mobile` runs the touch-control checks (real TouchEvents, plus layout at 844x390 and 390x844).
- `/?shot=start-screen|gameplay-rifle|knife|wave-banner|game-over|jump-midair` opens a fixed scene for screenshots.
- `/?shot=title-desktop|title-phone` (title screen with the logo), `/?shot=icon` (favicon at 128x128), `/?shot=favicon-tab` (favicon at 32x32 in a tab mock-up), `/?shot=logo-128` (logo at 128x64). These print the measured size.
- `/?shot=mobile-landscape|mobile-joystick|mobile-portrait|mobile-jump-button` (touch mode) and `/?shot=desktop-unchanged` (desktop mode).
- `/src/viewport.html?w=844&h=390&page=%2F%3Fshot%3Dmobile-landscape` shows a page at an exact phone size.

## Milestone 2 (not done yet)

Sounds, pickups / health, more zombie types.
