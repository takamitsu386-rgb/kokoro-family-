import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const handlerStart = html.indexOf('function setBulkSavedRoomFavorites(enabled)');
assert.notEqual(handlerStart, -1, 'Bulk favorite handler must exist.');
const handlerEnd = html.indexOf('\nfunction duplicateBulkSavedRooms()', handlerStart);
assert.notEqual(handlerEnd, -1, 'Bulk favorite handler must end before bulk duplication.');
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

const duplicateStart = html.indexOf('function duplicateBulkSavedRooms()');
assert.notEqual(duplicateStart, -1, 'Bulk duplication handler must exist.');
const duplicateEnd = html.indexOf('function deleteBulkSavedRooms()', duplicateStart);
assert.notEqual(duplicateEnd, -1, 'Bulk duplication handler must end before bulk deletion.');
const duplicate = html.slice(duplicateStart, duplicateEnd);
assert.match(html, /onclick="duplicateBulkSavedRooms\(\)"/, 'Bulk duplication button is missing.');
assert.match(duplicate, /bulkSavedRoomSelection/, 'Bulk duplication must use the current selection.');
assert.match(duplicate, /validRoomData\(rooms\[name\]\)/, 'Only valid room data may be duplicated.');
assert.match(duplicate, /Object\.keys\(rooms\)\.length\+selected\.length>100/, 'The saved-room capacity must be enforced.');
assert.match(duplicate, /while\(Object\.prototype\.hasOwnProperty\.call\(nextRooms,candidate\)\)/, 'Duplicate names must be made unique.');
assert.match(duplicate, /JSON\.parse\(JSON\.stringify\(rooms\[name\]\)\)/, 'Room snapshots must be copied rather than shared by reference.');
assert.match(duplicate, /saveSavedRoomsWithUndo\(nextRooms\)/, 'Bulk duplication must be undoable.');
assert.match(duplicate, /bulkSavedRoomSelection\.clear\(\)/, 'The selection must move to the created copies.');
assert.match(duplicate, /refreshSavedRooms\(\)/, 'The saved room list must refresh after duplication.');
console.log('Bulk saved-room favorites and duplication, validation, capacity, undo, and refresh checks passed.');
