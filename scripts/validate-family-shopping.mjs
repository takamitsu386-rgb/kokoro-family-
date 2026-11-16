import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const sw = await readFile(new URL("../sw.js", import.meta.url), "utf8");
const start = html.indexOf("async function uploadShoppingToFriend()");
const end = html.indexOf("function authErrorDetail(error)", start);
assert.ok(start >= 0 && end > start, "Shopping cloud sync module must exist.");
const cloud = html.slice(start, end);

for (const id of [
  "family-shopping", "familyShoppingForm", "familyShoppingSubmit",
  "familyShoppingCancel", "familyShoppingExport", "familyShoppingImportFile",
  "familyShoppingCloudUpload", "familyShoppingCloudDownload",
]) {
  assert.match(html, new RegExp('id="' + id + '"'), "Missing shopping UI: " + id);
}
assert.match(html, /const KEY\s*=\s*"kokoroFamilyShoppingV1"/);
assert.match(html, /const validEntry\s*=\s*entry\s*=>/);
assert.match(html, /Object\.hasOwn\(categories,item\.category\)/);
assert.match(html, /name\.textContent=item\.name/);
assert.match(html, /const safe=value=>/);
assert.match(html, /const parseCSV=text=>/);
assert.match(html, /finally\{importFile\.value="";\}/);

const uploadStart = cloud.indexOf("async function uploadShoppingCloud()");
const downloadStart = cloud.indexOf("async function downloadShoppingCloud()");
assert.ok(uploadStart >= 0 && downloadStart > uploadStart,
  "Personal shopping cloud handlers must exist.");
const upload = cloud.slice(uploadStart, downloadStart);
const download = cloud.slice(downloadStart);

for (const [name, source] of [
  ["personal upload", upload],
  ["personal download", download]
]) {
  assert.match(source, /generation=authStateGeneration/,
    name + " must capture the authentication generation.");
  assert.match(source, /authStateGeneration===generation/,
    name + " must reject account switches.");
  assert.match(source, /navigator\.onLine/,
    name + " must require an active network connection.");
}
assert.match(upload, /await runTransaction\(db,async transaction=>/,
  "Personal cloud overwrite must use a Firestore transaction.");
assert.match(upload, /baseline\.updatedAt\.isEqual\(latestData\.updatedAt\)/,
  "Personal cloud overwrite must reject concurrent updates.");
assert.match(upload, /readShoppingCloudPayload\(\)\)!==JSON\.stringify\(payload\)/,
  "Personal cloud upload must reject local edits made during upload.");
assert.match(download, /if\(!confirm\(/,
  "Personal cloud import must ask before replacing local data.");
assert.match(download, /latestSnapshot=await getDoc\(ref\)/,
  "Personal cloud import must re-read the latest cloud version.");
assert.match(download, /shoppingLocalSnapshotMatches\(localSnapshot\)/,
  "Personal cloud import must reject intervening local edits.");
assert.match(download, /Shopping cloud rollback failed/,
  "Personal cloud import must restore local data after a storage failure.");
assert.match(html, /<div hidden aria-hidden="true"[^>]*>[\s\S]*?familyShoppingSharedFriend[\s\S]*?familyShoppingShareStatus/,
  "Friend-sharing shopping controls must remain hidden for the MVP.");
assert.match(html, /友達との共有機能は初期版では利用できません。/);
const rules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
assert.match(rules, /match \/sharedShopping\/\{shareId\}\s*\{[\s\S]*?allow read, write: if false;/,
  "Friend-shared shopping data must be denied in the MVP.");
assert.match(sw, /const CACHE_NAME="kokoro-family-v369"/,
  "Service Worker cache version must match the current application shell.");
console.log("Family shopping UI, CSV safety, personal cloud sync, friend sharing, account isolation, and cache version checks passed.");
