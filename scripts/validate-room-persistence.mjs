import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const autoSaveStart = html.indexOf('function autoSaveRoom(){');
const historyStart = html.indexOf('function changeRoomHistory(direction){', autoSaveStart);
assert.ok(autoSaveStart >= 0 && historyStart > autoSaveStart, 'Room save and history handlers must exist.');
const autoSave = html.slice(autoSaveStart, historyStart);
assert.match(autoSave, /validRoomData\(data\)/, 'Current room data must be validated before saving.');
assert.match(autoSave, /previousRaw=localStorage\.getItem\('kokoroRoom'\)/, 'Previous room snapshot must be read before mutation.');
assert.match(autoSave, /oldHistory=localStorage\.getItem\('kokoroRoomHistory'\)/, 'Previous undo history must be retained.');
assert.match(autoSave, /oldRedo=localStorage\.getItem\('kokoroRoomRedo'\)/, 'Previous redo history must be retained.');
assert.ok(autoSave.indexOf("localStorage.setItem('kokoroRoomHistory'") < autoSave.indexOf("localStorage.setItem('kokoroRoom',nextRaw)"), 'History snapshot must be persisted before replacing the current room.');
assert.match(autoSave, /catch\(error\)\{[\s\S]*?oldHistory===null[\s\S]*?oldRedo===null/, 'Failed room writes must attempt to restore both history stores.');
assert.match(autoSave, /前回のお部屋データは保護しています/, 'Save failure must tell the user their previous room is protected.');
assert.match(autoSave, /return false;/, 'Failed room saves must be reported to callers.');

const loadStart = html.indexOf('function loadRoom(){');
const resetStart = html.indexOf('function resetRoom(){', loadStart);
assert.ok(loadStart >= 0 && resetStart > loadStart, 'Room startup recovery handler must exist.');
const load = html.slice(loadStart, resetStart);
assert.match(load, /validRoomData\(data\)/, 'Loaded room data must be validated.');
assert.match(load, /kokoroRoomRecovery/, 'Invalid current room data must be preserved in a recovery key.');
assert.match(load, /recoverySaved\?/, 'Startup must distinguish successful and failed recovery copies.');
assert.match(load, /元データを復旧用に保管しました/, 'Recovery success must be explained to the user.');
assert.match(load, /端末データを消さずに保管してください/, 'Recovery failure must warn against deleting original data.');

const savedStart = html.indexOf('function saveSavedRoomsWithUndo(nextRooms){');
const savedEnd = html.indexOf('\nfunction undoSavedRoomChange()', savedStart);
assert.ok(savedStart >= 0 && savedEnd > savedStart, 'Saved-room transaction handler must exist.');
const saved = html.slice(savedStart, savedEnd);
assert.match(saved, /validSavedRooms\(nextRooms\)/, 'Saved room collections must be validated.');
assert.match(saved, /previousUndo=localStorage\.getItem\('kokoroSavedRoomsUndo'\)/, 'Previous saved-room undo state must be retained.');
assert.match(saved, /localStorage\.setItem\('kokoroSavedRoomsUndo'/, 'Saved-room undo snapshot must be written.');
assert.match(saved, /catch\(error\)[\s\S]*?previousUndo===null/, 'Failed saved-room writes must restore the previous undo state.');
assert.match(saved, /元のお部屋データは変更していません/, 'Failed saved-room writes must preserve existing data.');

console.log('Room persistence, rollback, and startup recovery checks passed.');
