import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Logo and favicon: plain file checks, no browser. Paths are relative to the project root.
const root = new URL('../', import.meta.url);
const path = (rel) => fileURLToPath(new URL(rel, root));
const read = (rel) => {
  assert.ok(existsSync(path(rel)), `${rel} must exist`);
  return readFileSync(path(rel), 'utf8');
};

// Attributes of every <tag ...> in an HTML string, as plain objects.
const tags = (html, name) =>
  [...html.matchAll(new RegExp(`<${name}\\b([^>]*)>`, 'gi'))].map((m) =>
    Object.fromEntries([...m[1].matchAll(/([\w-]+)\s*=\s*"([^"]*)"/g)].map((a) => [a[1].toLowerCase(), a[2]])));

// No embedded pictures, no text elements, no web fonts and no files loaded from outside.
function assertSelfContained(svg, rel) {
  assert.doesNotMatch(svg, /<image\b/i, `${rel}: no <image>`);
  assert.doesNotMatch(svg, /<text\b/i, `${rel}: no <text>`);
  assert.doesNotMatch(svg, /@font-face|@import|font-family/i, `${rel}: no external or named font`);
  assert.doesNotMatch(svg, /(?:href|src)\s*=\s*"(?!#)/i, `${rel}: links only to ids inside the file`);
  assert.doesNotMatch(svg, /url\(\s*['"]?(?!#)/i, `${rel}: no url() to an outside file`);
}

test('assets/logo.svg: 512x256 viewBox, self-contained', () => {
  const svg = read('assets/logo.svg');
  assert.match(svg, /<svg\b[^>]*\bviewBox="0 0 512 256"/);
  assertSelfContained(svg, 'assets/logo.svg');
});

test('assets/logo.svg: ZOMBIE #7CFC00, ARENA #c1121f, both with a 6 wide #0b0f0a outline', () => {
  const svg = read('assets/logo.svg');
  const uses = tags(svg, 'use');
  const zombie = uses.find((u) => u.href === '#zombie' && u.fill);
  const arena = uses.find((u) => u.href === '#arena' && u.fill);
  assert.ok(zombie, 'a filled <use href="#zombie">');
  assert.ok(arena, 'a filled <use href="#arena">');
  assert.deepEqual([zombie.fill, zombie.stroke, zombie['stroke-width']], ['#7CFC00', '#0b0f0a', '6']);
  assert.deepEqual([arena.fill, arena.stroke, arena['stroke-width']], ['#c1121f', '#0b0f0a', '6']);
  assert.match(svg, /<g id="zombie">/);
  assert.match(svg, /<g id="arena">/);
});

test('assets/icon.svg: 512x512 viewBox, #111 rounded square radius 96, self-contained', () => {
  const svg = read('assets/icon.svg');
  assert.match(svg, /<svg\b[^>]*\bviewBox="0 0 512 512"/);
  const square = tags(svg, 'rect').find((r) => r.width === '512' && r.height === '512');
  assert.ok(square, 'a 512x512 <rect>');
  assert.deepEqual([square.fill, square.rx], ['#111', '96']);
  assertSelfContained(svg, 'assets/icon.svg');
});

test('index.html: favicon is assets/icon.svg', () => {
  const html = read('index.html');
  const icons = tags(html, 'link').filter((l) => (l.rel || '').split(/\s+/).includes('icon'));
  assert.equal(icons.length, 1, 'one <link rel="icon">');
  assert.equal(icons[0].href, 'assets/icon.svg');
});

test('index.html: element id="logo" shows assets/logo.svg', () => {
  const html = read('index.html');
  const logos = tags(html, '[a-z][a-z0-9]*').filter((t) => t.id === 'logo');
  assert.equal(logos.length, 1, 'one element with id="logo"');
  assert.equal(logos[0].src, 'assets/logo.svg');
});
