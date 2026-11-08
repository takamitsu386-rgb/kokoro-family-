import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync('index.html', 'utf8');
assert.match(html, /<a href="#room-presets">お部屋セット<\/a>/,
  'Room templates must be reachable from the main navigation.');
assert.match(html, /<a href="#room-presets">🏡 お部屋セットから始める<\/a>/,
  'The home screen must offer a direct entry to room templates.');
assert.match(html, /<section class="panel" id="room-presets">[\s\S]*?id="roomTemplateList"/,
  'The room template section and render target must exist.');

const source = html.match(/const roomTemplates=(\{[\s\S]*?\n\});/);
assert.ok(source, 'The room template catalogue must exist.');
const templates = Function('return (' + source[1] + ')')();
assert.deepEqual(Object.keys(templates), ['bedroom', 'living', 'study', 'nature', 'cafe'],
  'The starter catalogue must include the five intended room types.');

const allowedIcons = new Set([
  '🛏️','🪴','💡','🧸','🖼️','🛋️','📺','🧺','🖥️','🪑',
  '📚','🧩','🌻','🌵','☕','🧁','🌷'
]);
for (const [key, template] of Object.entries(templates)) {
  assert.ok(template.label && template.description, key + ' needs a clear label and description.');
  assert.match(template.wall, /^#[0-9a-f]{6}$/i, key + ' wall color must be a safe hex color.');
  assert.match(template.floor, /^#[0-9a-f]{6}$/i, key + ' floor color must be a safe hex color.');
  assert.ok(Array.isArray(template.items) && template.items.length >= 4,
    key + ' must provide a useful starter furniture layout.');
  for (const item of template.items) {
    assert.equal(item.length, 4, key + ' furniture entries must include icon, position, and size.');
    assert.ok(allowedIcons.has(item[0]), key + ' uses an unsupported furniture icon: ' + item[0]);
    assert.match(item[1], /^(?:[0-9]|[1-9][0-9])%$/, key + ' has an invalid horizontal position.');
    assert.match(item[2], /^(?:[0-9]|[1-9][0-9])%$/, key + ' has an invalid vertical position.');
    assert.match(item[3], /^(?:[2-7][0-9])px$/, key + ' has an invalid furniture size.');
  }
}

const applyStart = html.indexOf('function applyRoomTemplate(key)');
const renderStart = html.indexOf('const roomTemplateList=', applyStart);
assert.ok(applyStart >= 0 && renderStart > applyStart, 'Template application and rendering must exist.');
const apply = html.slice(applyStart, renderStart);
assert.match(apply, /Object\.prototype\.hasOwnProperty\.call\(roomTemplates,key\)/,
  'Only a known template key may be applied.');
assert.match(apply, /if\(!validRoomData\(data\)\)/,
  'Template data must pass the existing room-data validator.');
assert.match(apply, /confirm\(/,
  'Replacing the current room must require confirmation.');
assert.match(apply, /if\(applyRoom\(data\)\)/,
  'Templates must use the existing rollback-safe room application and save path.');
assert.match(apply, /あとから「1つ戻す」で復元できます/,
  'The replacement confirmation must explain how to undo the change.');
assert.match(html, /button\.addEventListener\('click',\(\)=>applyRoomTemplate\(key\)\)/,
  'Each rendered template button must invoke its corresponding template.');

console.log('Validated five room templates, their furniture layouts, safe application, and undo guidance.');
