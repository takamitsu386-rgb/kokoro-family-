import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const spec = readFileSync(new URL("../ACCOUNT_DELETION_SPEC.md", import.meta.url), "utf8");

const localKeys = [
  "kokoroCustomRoomPalettesBeforePaletteImport",
  "kokoroSavedRooms",
  "kokoroSavedRoomsUndo",
  "kokoroSavedRoomPrefs",
  "kokoroRoom",
  "kokoroRoomHistory",
  "kokoroRoomRedo",
  "kokoroRoomRecovery",
  "kokoroSavedRoomsRecovery",
  "kokoroRoomBeforeImport",
  "kokoroSavedRoomsBeforeImport",
  "kokoroSavedRoomPrefsBeforeImport",
  "kokoroCustomRoomPalettesBeforeImport",
  "kokoroRoomBeforeRecovery",
  "kokoroSavedRoomsBeforeRecovery",
  "kokoroSavedRoomPrefsBeforeRecovery",
  "kokoroCustomRoomPalettesBeforeRecovery",
  "kokoroCloudSyncUid",
  "kokoroRoomBeforeCloudImport",
  "kokoroSavedRoomsBeforeCloudImport",
  "kokoroSavedRoomPrefsBeforeCloudImport",
  "kokoroCustomRoomPalettesBeforeCloudImport",
  "kokoroReturnToAiAfterLogin",
  "kokoroTodayTasksV1",
  "kokoroDailyRoutinesV1"
];

for (const key of localKeys) {
  assert.ok(html.includes(key), "Storage key no longer appears in application source: " + key);
  assert.ok(spec.includes("`" + key + "`"), "Deletion specification is missing local storage key: " + key);
}

for (const collection of [
  "sharedShopping", "profiles", "posts", "comments", "likes",
  "friendRequests", "sharedRooms", "reports", "reservations",
  "timelineUsage", "blocks"
]) {
  assert.ok(spec.includes("`" + collection + "`"),
    "Deletion specification is missing a known Firestore collection: " + collection);
}

assert.match(spec, /この一覧は現時点で検出できたキーの基準/);
assert.match(spec, /動的に組み立てるキーや別モジュールの保存先がないことを保証しません/);
console.log("Account-deletion inventory: " + localKeys.length + " local keys and 11 Firestore collection references checked.");
