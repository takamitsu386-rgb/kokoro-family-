import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const ui = [
  'onclick="setBulkSavedRoomFavorites(true)"',
  'onclick="setBulkSavedRoomFavorites(false)"',
  'function setBulkSavedRoomFavorites(enabled)'
];
for (const item of ui) assert.ok(html.includes(item), 'Missing bulk favorite feature: ' + item);
const start = html.indexOf('function setBulkSavedRoomFavorites(enabled)');
const end = html.indexOf('function deleteBulkSavedRooms()', start);
assert.ok(start >= 0 && end > start, 'Bulk favorite handler must be a complete function.');
const handler = html.slice(start, end);
assert.match(handler, /savedRoomData\(\),prefs=readSavedRoomPrefs\(\)/);
assert.match(handler, /bulkSavedRoomSelection\]/);
assert.match(handler, /favorites\.add\(name\)/);
assert.match(handler, /favorites\.delete\(name\)/);
assert.match(handler, /writeSavedRoomPrefs\(prefs\)/);
assert.match(handler, /refreshSavedRooms\(\)/);
assert.match(handler, /if\(!selected\.length\)/);
console.log('Validated bulk saved-room favorite registration and removal.');
