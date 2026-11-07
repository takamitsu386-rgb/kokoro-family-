import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync('index.html', 'utf8');
const start = html.indexOf('const statusEl = document.getElementById("cloudSyncStatus")');
const end = html.indexOf('</script>', start);
assert.ok(start >= 0 && end > start, 'Firebase sync module must exist.');
const sync = html.slice(start, end);

assert.match(sync, /let uploadQueue = Promise\.resolve\(\)/,
  'Cloud uploads must be serialized.');
assert.match(sync, /uploadQueue\.catch\(\(\) => \{\}\)\.then\(async \(\) =>/,
  'A failed prior upload must not permanently block the upload queue.');
assert.match(sync, /currentUser\.uid !== uid/,
  'Sync operations must verify the active account UID.');
assert.match(sync, /async function uploadLocal\(uid = currentUser\?\.uid\)/,
  'Cloud upload must bind the operation to a specific signed-in UID.');
assert.match(sync, /await uploadQueue\.catch\(\(\) => \{\}\);[\s\S]*?getDoc\(cloudRef\(uid\)\)/,
  'Cloud reads must wait for queued uploads.');
assert.match(sync, /!\["__proto__", "constructor", "prototype"\]\.includes\(name\)/,
  'Room preference keys must reject prototype-sensitive property names before cloud import.');
const prefsStart = sync.indexOf('function validSavedRoomPrefs(value)');
const prefsEnd = sync.indexOf('function defaultSavedRoomPrefs()', prefsStart);
assert.ok(prefsStart >= 0 && prefsEnd > prefsStart, 'Saved-room preference validator must exist.');
const prefsValidator = sync.slice(prefsStart, prefsEnd);
assert.equal((prefsValidator.match(/!\["__proto__", "constructor", "prototype"\]\.includes\(name\)/g) || []).length, 4,
  'Favorites, order, categories, and notes must each reject prototype-sensitive property names.');
assert.match(sync, /function validCloudData\(data\)/,
  'Cloud data must be validated before import.');
assert.match(sync, /if \(!validCloudData\(data\)\)/,
  'Malformed cloud data must be rejected before it is applied.');
assert.match(sync, /function applyCloudDataSafely\(data\)/,
  'Cloud imports must use the rollback-protected application path.');
assert.match(sync, /function storeCloudDataSafely\(data, previousDisplayRoom\)/,
  'Cloud imports must snapshot and safely restore local data.');
assert.match(sync, /kokoroCloudSyncUid/,
  'Initial sync completion must be tracked per account.');
assert.match(sync, /初回同期がまだです。[\s\S]*?return;/,
  'Automatic uploads must remain blocked until the initial sync choice is made.');
assert.match(sync, /このアカウントにはクラウドデータがあります。[\s\S]*?クラウドから読み込む／キャンセル：この端末のデータをクラウドへ保存する/,
  'First sync must ask before choosing which existing dataset to keep.');
assert.match(sync, /if \(!navigator\.onLine\)[\s\S]*?端末内データはそのままです/,
  'Offline cloud operations must stop without discarding local data.');
assert.match(sync, /window\.addEventListener\("online"/,
  'Cloud sync must be reconsidered after connectivity returns.');
assert.match(sync, /document\.addEventListener\("visibilitychange"/,
  'Returning to the app must check for pending cloud changes.');
assert.match(sync, /if \(syncInProgress\) \{\s*syncPending = true;/,
  'Automatic sync requests must be deferred while another sync is active.');
assert.match(sync, /logoutInProgress = true;[\s\S]*?await uploadQueue\.catch[\s\S]*?await signOut\(auth\)/,
  'Logout must stop new syncs and wait for queued uploads before signing out.');
assert.match(sync, /const delay = \[3000, 10000, 30000\]\[syncRetryCount\+\+\]/,
  'Automatic sync retries must be bounded with increasing delays.');
assert.match(sync, /const mobileBrowser = \/Android\|iPhone\|iPad\|iPod\/i\.test\(navigator\.userAgent\)/,
  'Mobile browsers must be detected for redirect-based Google login.');
assert.match(sync, /await signInWithRedirect\(auth, provider\)/,
  'Mobile Google login must use redirect authentication.');
assert.match(sync, /await signInWithPopup\(auth, provider\)/,
  'Desktop Google login must retain popup authentication.');
assert.match(sync, /redirectResult = await getRedirectResult\(auth\)/,
  'Redirect login results must be processed on page initialization.');
assert.match(sync, /onAuthStateChanged\(auth, user =>/,
  'Sync state must follow Firebase authentication changes.');

const backupStart = html.indexOf('const MAX_BACKUP_BYTES=10*1024*1024;');
const backupEnd = html.indexOf('let uploadQueue = Promise.resolve()', backupStart);
assert.ok(backupStart >= 0 && backupEnd > backupStart, 'Backup export and import handlers must exist.');
const backup = html.slice(backupStart, backupEnd);
assert.match(backup, /if\(file\.size>MAX_BACKUP_BYTES\)/,
  'Backup preview and import must reject oversized files.');
assert.match(backup, /if\(request!==backupPreviewRequest\)return;/,
  'An older asynchronous backup preview must not replace a newer file selection.');
assert.match(backup, /!validRoomData\(data\.currentRoom\)[\s\S]*?!validSavedRooms\(data\.savedRooms\)[\s\S]*?!validSavedRoomPrefs\(previewPrefs\)/,
  'Backup preview must validate current room, saved rooms, and preferences before rendering.');
assert.match(backup, /kokoroRoomBeforeImport[\s\S]*?kokoroSavedRoomsBeforeImport[\s\S]*?kokoroSavedRoomPrefsBeforeImport/,
  'Full backup import must preserve recovery copies of all local datasets.');
assert.match(backup, /if\(applyRoom\(data\.currentRoom,false\)!==true\)throw new Error\("room restore failed"\)[\s\S]*?if\(previousRoom===null\)localStorage\.removeItem\("kokoroRoom"\)/,
  'Full backup import must restore prior local datasets if applying the imported room fails.');
assert.match(backup, /Object\.prototype\.hasOwnProperty\.call\(data\.savedRooms,sourceName\)/,
  'Selecting a saved room from a backup must verify that the selected key is an own property.');

const selectedImportStart = backup.indexOf('function importSelectedRoomFromBackup()');
const fullImportStart = backup.indexOf('function importRoomBackup()');
assert.ok(selectedImportStart >= 0 && fullImportStart > selectedImportStart, 'Saved-room and full backup import handlers must exist.');
const selectedImport = backup.slice(selectedImportStart, fullImportStart);
assert.match(selectedImport, /if\(!saveSavedRoomsWithUndo\(nextRooms\)\)return;/,
  'Importing one saved room must use the guarded save-and-undo path.');
assert.match(selectedImport, /if\(Object\.keys\(rooms\)\.length>=100\)/,
  'Importing a saved room must enforce the saved-room count limit.');
const fullImport = backup.slice(fullImportStart);
assert.match(fullImport, /if\(!confirm\([\s\S]*?\)\)return;[\s\S]*?localStorage\.setItem\("kokoroRoomBeforeImport"/,
  'Canceling full backup import must happen before any local data is changed.');
assert.match(fullImport, /finally\{\s*input\.value="";\s*\}/,
  'The backup file input must be cleared after import processing.');


const aiStart = html.indexOf('const aiLog = document.getElementById("aiChatLog")');
const aiEnd = html.indexOf('</script>', aiStart);
assert.ok(aiStart >= 0 && aiEnd > aiStart, 'AI client module must exist.');
const ai = html.slice(aiStart, aiEnd);
assert.match(ai, /let aiAuthGeneration = 0/,
  'AI requests must be tied to an authentication generation.');
assert.match(ai, /if \(aiCurrentUid !== nextUid\) \{\s*aiAuthGeneration \+= 1;/,
  'Changing accounts must invalidate in-flight AI requests.');
assert.match(ai, /aiHistory\.length = 0;[\s\S]*?aiLog\.replaceChildren\(\)/,
  'Changing accounts must clear the previous account conversation.');
assert.match(ai, /const requestAuthGeneration = aiAuthGeneration/,
  'AI requests must capture the authentication generation at send time.');
assert.match(ai, /aiAuthGeneration !== requestAuthGeneration/,
  'AI responses must be rejected after an account change.');
assert.match(ai, /userBubble\.remove\(\)/,
  'A failed or stale AI response must not leave an unconfirmed user message in the transcript.');
assert.match(ai, /aiInput\.value = message/,
  'A failed request for the same account must preserve the typed message for retry.');

const snsStart = html.indexOf('const snsStatus = document.getElementById("snsStatus")');
const snsEnd = html.indexOf('</script>', snsStart);
assert.ok(snsStart >= 0 && snsEnd > snsStart, 'SNS client module must exist.');
const sns = html.slice(snsStart, snsEnd);
assert.doesNotMatch(sns, /finally\s*\{\s*snsSetBusy\(false\);/,
  'SNS asynchronous cleanup must never release a possibly newer account busy state unconditionally.');
assert.ok((sns.match(/finally \{ snsReleaseBusyFor\(user\); \}/g) || []).length >= 5,
  'SNS profile, post, report, and refresh operations must use account-scoped busy cleanup.');
assert.match(sns, /function snsReleaseBusyFor\(user\) \{[\s\S]*?if \(user && snsUser\?\.uid === user\.uid\) snsSetBusy\(false\);/,
  'A stale SNS request must not unlock controls belonging to a different account.');
assert.match(sns, /finally \{ snsReleaseBusyFor\(activeUser\); \}/,
  'Unblocking must release its busy state only for the account that started it.');
assert.match(sns, /finally \{\s*snsReleaseBusyFor\(user\);\s*\}/,
  'Post edits and deletions must release their busy state only for the account that started them.');
assert.match(sns, /const response = await fetch\(path,[\s\S]*?if \(!snsUser \|\| snsUser\.uid !== user\.uid\) throw new Error\("アカウントが切り替わりました。"\);[\s\S]*?const data = await response\.json\(\)/,
  'Admin API responses must be discarded if the signed-in account changes while the request is in flight.');
const staleAdminSequence = [
  'console.error("SNS admin claim check failed", error);',
  '    }',
  '    if (!snsUser || snsUser.uid !== user.uid) return;',
  '    snsMessage("プロフィールを読み込んでいます…");'
].join("\n");
assert.ok(sns.includes(staleAdminSequence),
  'A stale SNS auth callback must stop after its asynchronous admin-claim check instead of overwriting the current account status.');
assert.match(sns, /const user = snsUser;\s*if \(!user\) return;\s*try \{\s*await snsLoadAdminReports\(user\);\s*\} catch \(error\) \{\s*if \(!snsUser \|\| snsUser\.uid !== user\.uid\) return;/,
  'Admin report refresh failures must be scoped to the account that started the request.');
assert.match(sns, /const accountChanged = snsUser\?\.uid !== user\?\.uid/,
  'SNS must detect account changes before showing account-specific content.');
assert.match(sns, /catch \\(error\\) \\{\\s*if \\(!snsUser \\|\\| snsUser\\.uid !== user\\.uid\\) return;\\s*console\\.error\\("SNS admin claim check failed", error\\);\\s*\\}\\s*if \\(!snsUser \\|\\| snsUser\\.uid !== user\\.uid\\) return;\\s*snsMessage\\("プロフィールを読み込んでいます… " \\);/,
  'A stale SNS auth callback must stop after its asynchronous admin-claim check instead of overwriting the current account status.');assert.match(sns, /if \(accountChanged\) \{[\s\S]*?snsNickname\.value = ""[\s\S]*?snsRenderPosts\(\[\]\)[\s\S]*?snsBlockList\.replaceChildren\(\)[\s\S]*?snsBlockUid\.value = ""[\s\S]*?snsReportUid\.value = ""/,
  'SNS must clear private profile, post, block, and report form data on account changes.');
for (const loader of ['snsLoadProfile', 'snsLoadPosts', 'snsLoadBlocks']) {
  const loaderStart = sns.indexOf('async function ' + loader + '(user)');
  const loaderEnd = sns.indexOf('\n}', loaderStart);
  assert.ok(loaderStart >= 0 && loaderEnd > loaderStart, loader + ' must exist.');
  assert.match(sns.slice(loaderStart, loaderEnd), /!snsUser \|\| snsUser\.uid !== user\.uid/,
    loader + ' must discard results after an account switch.');
}

const uploadLocalStart = html.indexOf('async function uploadLocal(uid = currentUser?.uid)');
const uploadLocalEnd = html.indexOf('\nasync function downloadCloud()', uploadLocalStart);
assert.ok(uploadLocalStart >= 0 && uploadLocalEnd > uploadLocalStart, 'Cloud upload operation must exist.');
const uploadLocalOperation = html.slice(uploadLocalStart, uploadLocalEnd);
assert.match(uploadLocalOperation, /if \(!uid \|\| !currentUser \|\| currentUser\.uid !== uid\) throw new Error/,
  'Cloud uploads must reject a UID that is not the active account before queueing.');
assert.match(uploadLocalOperation, /uploadQueue\.catch\(\(\) => \{\}\)\.then\(async \(\) => \{\s*if \(!currentUser \|\| currentUser\.uid !== uid\) throw new Error/,
  'Queued cloud uploads must re-check the active account immediately before reading local data and writing.');
assert.match(uploadLocalOperation, /await setDoc\(cloudRef\(uid\),[\s\S]*?if \(!currentUser \|\| currentUser\.uid !== uid\) throw new Error/,
  'Cloud upload completion must verify the originating account before reporting success.');

const queueSyncStart = html.indexOf('function queueSync()');
const queueSyncEnd = html.indexOf('\ntry {', queueSyncStart);
assert.ok(queueSyncStart >= 0 && queueSyncEnd > queueSyncStart, 'Automatic cloud sync queue must exist.');
const queueSyncHandler = html.slice(queueSyncStart, queueSyncEnd);
assert.ok(queueSyncHandler.includes('const queuedUid = currentUser.uid;') &&
  queueSyncHandler.includes('if (!currentUser || currentUser.uid !== queuedUid) return;'),
  'Delayed automatic sync must stop when the originating account is no longer active.');
assert.ok(queueSyncHandler.includes('if (currentUser && currentUser.uid === queuedUid) {') &&
  queueSyncHandler.includes('if (currentUser && currentUser.uid === queuedUid && !logoutInProgress) queueSync();'),
  'Automatic sync success notices and retries must remain scoped to the originating account.');

const downloadCloudStart = html.indexOf('async function downloadCloud()');
const downloadCloudEnd = html.indexOf('\nasync function syncNow()', downloadCloudStart);
assert.ok(downloadCloudStart >= 0 && downloadCloudEnd > downloadCloudStart, 'Cloud download operation must exist.');
const downloadCloudOperation = html.slice(downloadCloudStart, downloadCloudEnd);
assert.match(downloadCloudOperation, /if \(!currentUser \|\| currentUser\.uid !== uid\) throw new Error\("確認中にGoogleアカウントが切り替わりました。端末内データは変更していません。"\);\s*applyCloudDataSafely\(data\);/,
  'Cloud data must not be applied after the account changes during the confirmation prompt.');

const syncNowStart = html.indexOf('async function syncNow()');
const syncNowEnd = html.indexOf('\nfunction queueSync()', syncNowStart);
assert.ok(syncNowStart >= 0 && syncNowEnd > syncNowStart, 'Manual cloud sync handler must exist.');
const syncNowHandler = html.slice(syncNowStart, syncNowEnd);
assert.match(syncNowHandler, /catch \(error\) \{\s*if \(!currentUser \|\| currentUser\.uid !== uid\) return;/,
  'A failed manual sync must not show an old account error after an account switch.');
const downloadHandlerStart = html.indexOf('downloadButton.addEventListener("click"');
const downloadHandlerEnd = html.indexOf('logoutButton.addEventListener("click"', downloadHandlerStart);
assert.ok(downloadHandlerStart >= 0 && downloadHandlerEnd > downloadHandlerStart, 'Cloud download click handler must exist.');
const downloadHandler = html.slice(downloadHandlerStart, downloadHandlerEnd);
assert.match(downloadHandler, /const user = currentUser;[\s\S]*?if \(!currentUser \|\| currentUser\.uid !== user\.uid\) return;/,
  'A failed cloud download must not overwrite the status for a newly signed-in account.');

const adminFilterStart = sns.indexOf('snsAdminFilter.addEventListener("change"');
const adminFilterEnd = sns.indexOf('if (snsApp)', adminFilterStart);
assert.ok(adminFilterStart >= 0 && adminFilterEnd > adminFilterStart,
  'Admin report filter handler must exist.');
const adminFilterHandler = sns.slice(adminFilterStart, adminFilterEnd);
assert.ok(adminFilterHandler.includes('const user = snsUser;') &&
  adminFilterHandler.includes('if (!snsUser || snsUser.uid !== user.uid) return;'),
  'Admin report filter failures must be scoped to the account that started the request.');
const adminActionStart = sns.indexOf('snsAdminRequest("/api/admin/update-report"');
const adminActionEnd = sns.indexOf('actions.appendChild(button)', adminActionStart);
assert.ok(adminActionStart >= 0 && adminActionEnd > adminActionStart,
  'Admin report action handler must exist.');
const adminActionHandler = sns.slice(adminActionStart, adminActionEnd);
assert.ok(adminActionHandler.includes('if (!snsUser || snsUser.uid !== user.uid) return;') &&
  adminActionHandler.includes('button.disabled = false;'),
  'Admin report action failures must not alter controls after an account switch.');

for (const [guard, failure] of [
  ['if (!snsUser || snsUser.uid !== activeUser.uid) return;', 'console.error("SNS unblock failed", error);'],
  ['if (!snsUser || snsUser.uid !== user.uid) return;', 'console.error("SNS post edit failed", error);'],
  ['if (!snsUser || snsUser.uid !== user.uid) return;', 'console.error("SNS post delete failed", error);'],
  ['if (!snsUser || snsUser.uid !== user.uid) return;', 'console.error("SNS block failed", error);'],
  ['if (!snsUser || snsUser.uid !== user.uid) return;', 'console.error("SNS profile save failed", error);'],
  ['if (!snsUser || snsUser.uid !== user.uid) return;', 'console.error("SNS post create failed", error);'],
  ['if (!snsUser || snsUser.uid !== user.uid) return;', 'console.error("SNS post refresh failed", error);']
]) {
  const failureIndex = sns.indexOf(failure);
  assert.ok(failureIndex > 0 &&
    sns.slice(Math.max(0, failureIndex - 150), failureIndex).includes(guard),
    'SNS failure notices must be scoped to the account that started the request: ' + failure);
}

assert.ok(sns.includes('const nickname = snsNickname.value.trim();') &&
  sns.includes('if (!nickname || nickname.length > 24)'),
  'SNS profile names must be trimmed and constrained to 1–24 characters before saving.');
assert.ok(sns.includes('const text = snsPostText.value.trim();') &&
  sns.includes('if (!text || text.length > 500)'),
  'SNS post content must be trimmed and constrained to 1–500 characters before saving.');
assert.match(html, /id="snsNickname" maxlength="24"/,
  'The profile nickname input must expose the same 24-character limit to users.');
assert.match(html, /id="snsPostText" maxlength="500"/,
  'The post editor must expose the same 500-character limit to users.');

console.log('Cloud sync sequencing, account isolation, local-data protection, login flow, and AI and SNS account-switch checks passed.');
