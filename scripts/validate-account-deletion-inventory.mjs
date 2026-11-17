import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const spec = readFileSync(new URL("../ACCOUNT_DELETION_SPEC.md", import.meta.url), "utf8");

const localKeys = [
  "kokoroCustomRoomPalettes",
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
  "kokoroTodayTasksV1",
  "kokoroDailyRoutinesV1",
  "kokoroFamilyCalendarV1",
  "kokoroFamilyMealsV1",
  "kokoroFamilyRecipesV1",
  "kokoroFamilyRecipeFavoritesV1",
  "kokoroFamilyEventPrepV1",
  "kokoroFamilyShoppingV1",
  "kokoroFamilyTasksV1"
];

for (const key of localKeys) {
  assert.ok(html.includes(key), "Storage key no longer appears in application source: " + key);
  assert.ok(spec.includes("`" + key + "`"), "Deletion specification is missing local storage key: " + key);
}

const literalLocalStorageKeys = [...new Set(
  [...html.matchAll(/localStorage\.(?:getItem|setItem|removeItem)\(\s*["']([^"']+)["']/g)]
    .map(match => match[1])
)];
for (const key of literalLocalStorageKeys) {
  assert.ok(spec.includes("`" + key + "`"),
    "Deletion specification is missing a literal localStorage key: " + key);
}

assert.ok(html.includes('sessionStorage.setItem("kokoroReturnToAiAfterLogin"'),
  "Session-only login return state must remain visible in the deletion inventory.");
assert.ok(spec.includes("`kokoroReturnToAiAfterLogin`") && spec.includes("`sessionStorage`"),
  "Session storage must be documented separately from persistent local storage.");

for (const collection of [
  "sharedShopping", "profiles", "posts", "comments", "likes",
  "friendRequests", "sharedRooms", "reports", "reservations",
  "timelineUsage", "blocks", "aiUsage", "profileSearchUsage", "reportUsage", "following", "hiddenSharedRooms", "receivedSharedRooms"
]) {
  const documentedAsName = spec.includes("`" + collection + "`");
  const documentedAsPathSegment = new RegExp("`[^\`]*\\/" + collection + "\\/");
  assert.ok(documentedAsName || documentedAsPathSegment.test(spec),
    "Deletion specification is missing a known Firestore collection: " + collection);
}

for (const path of ["users/{uid}/kokoro/data", "users/{uid}/kokoro/shopping", "profiles/{uid}", "posts/{postId}", "posts/{postId}/comments/{commentId}", "posts/{postId}/likes/{likerUid}", "friendRequests/{requestId}", "sharedShopping/{shareId}", "sharedRooms/{shareId}", "reports/{reportId}", "users/{uid}/aiUsage/{dayKey}"{
  assert.ok(spec.includes("`" + path + "`"), "Deletion specification is missing a Firestore path: " + path);
}
assert.ok(html.includes('const SNS_SHARE_CLEANUP_QUEUE_PREFIX = "kokoro-sns-share-cleanup-v1:"'),
  "UID-scoped SNS cleanup queue prefix must remain visible in the source inventory.");
assert.ok(spec.includes("`kokoro-sns-share-cleanup-v1:{uid}`"),
  "Deletion specification must document the UID-scoped SNS cleanup queue.");
assert.ok(spec.includes("`reservations`"), "Deletion specification must include AI quota reservation subcollections.");
assert.match(spec, /この一覧は現時点で検出できたキーの基準/);
assert.match(spec, /動的に組み立てるキーや別モジュールの保存先がないことを保証しません/);
console.log("Account-deletion inventory: " + localKeys.length + " local keys, one UID-scoped key prefix, and " + 23 + " Firestore paths checked.");
