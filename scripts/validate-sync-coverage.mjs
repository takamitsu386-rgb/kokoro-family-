import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync('index.html', 'utf8');
const syncStart = html.indexOf('function localPayload()');
const syncEnd = html.indexOf('function cloudRef(uid)', syncStart);
assert.ok(syncStart >= 0 && syncEnd > syncStart, 'Main room cloud payload builder must exist.');
const payloadBuilder = html.slice(syncStart, syncEnd);

for (const key of [
  'kokoroRoom',
  'kokoroSavedRooms',
  'kokoroSavedRoomPrefs',
  'CUSTOM_ROOM_PALETTE_KEY'
]) {
  assert.ok(payloadBuilder.includes(key), 'Main cloud sync must include room data key: ' + key);
}
for (const key of [
  'kokoroTodayTasksV1',
  'kokoroFamilyTasksV1',
  'kokoroFamilyCalendarV1',
  'kokoroFamilyMealsV1',
  'kokoroFamilyRecipesV1',
  'kokoroFamilyRecipeFavoritesV1',
  'kokoroFamilyEventPrepV1'
]) {
  assert.ok(!payloadBuilder.includes(key), 'A local-only feature must not silently appear in the room sync payload: ' + key);
}

const roomSyncSectionStart = html.indexOf('id="cloudSyncNow"');
const roomSyncSectionEnd = html.indexOf('</section>', roomSyncSectionStart);
assert.ok(roomSyncSectionStart >= 0 && roomSyncSectionEnd > roomSyncSectionStart,
  'Room cloud sync UI section must exist.');
const roomSyncSection = html.slice(roomSyncSectionStart, roomSyncSectionEnd);
assert.match(roomSyncSection, /同期の対象：お部屋・保存したお部屋・お部屋の設定です。/,
  'The main sync screen must clearly state what is included.');
assert.match(roomSyncSection, /買い物リスト・購入履歴・予算は、買い物画面の専用ボタンから別に同期してください。/,
  'The main sync screen must distinguish the separate shopping sync controls.');
assert.match(roomSyncSection, /今日の予定・家族のやること・カレンダー・献立・レシピは現在この端末だけに保存され/,
  'The main sync screen must disclose family modules that do not sync across devices yet.');

const localOnlyModules = [
  ['kokoroTodayTasksV1', /localStorage\.getItem\(STORAGE_KEY\)/, /localStorage\.setItem\(STORAGE_KEY,/],
  ['kokoroFamilyTasksV1', /localStorage\.getItem\(KEY\)/, /localStorage\.setItem\(KEY,\s*JSON\.stringify\(next\)\)/],
  ['kokoroFamilyCalendarV1', /localStorage\.getItem\(KEY\)/, /localStorage\.setItem\(KEY,\s*JSON\.stringify\(next\)\)/],
  ['kokoroFamilyMealsV1', /localStorage\.getItem\(KEY\)/, /localStorage\.setItem\(KEY,\s*JSON\.stringify\(next\)\)/],
  ['kokoroFamilyRecipesV1', /localStorage\.getItem\(KEY\)/, /localStorage\.setItem\(KEY,\s*JSON\.stringify\(next\)\)/]
];
for (const [key, readPattern, writePattern] of localOnlyModules) {
  assert.ok(html.includes(key), 'Expected family module storage key missing: ' + key);
  assert.match(html, readPattern, 'The local-only family module must read from localStorage: ' + key);
  assert.match(html, writePattern, 'The local-only family module must save locally: ' + key);
}
assert.match(html, /id="familyShoppingCloudUpload"/,
  'Shopping must retain its separate cloud upload action.');
assert.match(html, /id="familyShoppingCloudDownload"/,
  'Shopping must retain its separate cloud download action.');

console.log('Cloud sync coverage disclosure and local-only family module boundaries passed.');
