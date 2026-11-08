import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const handlerStart = html.indexOf('function setBulkSavedRoomFavorites(enabled)');
assert.notEqual(handlerStart, -1, 'Bulk favorite handler must exist.');
const handlerEnd = html.indexOf('\nfunction deleteBulkSavedRooms()', handlerStart);
assert.notEqual(handlerEnd, -1, 'Bulk favorite handler must end before bulk deletion.');
const handler = html.slice(handlerStart, handlerEnd);

assert.match(html, /onclick="setBulkSavedRoomFavorites\(true\)"/, 'Bulk favorite button is missing.');
assert.match(html, /onclick="setBulkSavedRoomFavorites\(false\)"/, 'Bulk unfavorite button is missing.');
assert.match(handler, /savedRoomData\(\)/, 'Saved room data must be read.');
assert.match(handler, /readSavedRoomPrefs\(\)/, 'Saved room preferences must be read.');
assert.match(handler, /bulkSavedRoomSelection/, 'Only selected rooms may be changed.');
assert.match(handler, /Object\.prototype\.hasOwnProperty\.call\(rooms,name\)/, 'Stale selections must be excluded.');
assert.match(handler, /new Set\(prefs\.favorites\)/, 'Favorite updates must avoid duplicates.');
assert.match(handler, /favorites\.add\(name\)/, 'Favorite mode must add selected rooms.');
assert.match(handler, /favorites\.delete\(name\)/, 'Unfavorite mode must remove selected rooms.');
assert.match(handler, /writeSavedRoomPrefs\(prefs\)/, 'Updated preferences must be persisted.');
assert.match(handler, /refreshSavedRooms\(\)/, 'The saved room view must refresh.');
assert.match(handler, /if\(!selected\.length\)/, 'Empty selections must be rejected.');
console.log('Bulk saved-room favorite controls, selection validation, persistence, and refresh checks passed.');
