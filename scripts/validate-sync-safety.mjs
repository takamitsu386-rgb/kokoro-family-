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
assert.match(sync, /async function uploadLocal\(uid = currentUser\?\.uid\) \{\s*const generation = authStateGeneration;/,
  'Each queued cloud upload must capture the authentication generation that started it.');
assert.match(sync, /if \(!currentUser \|\| currentUser\.uid !== uid \|\| authStateGeneration !== generation\) throw new Error\("同期待ちの間にGoogleアカウントが切り替わりました。/,
  'A queued cloud upload must reject A-to-B-to-A account switches before writing.');
assert.match(sync, /if \(!currentUser \|\| currentUser\.uid !== uid \|\| authStateGeneration !== generation\) throw new Error\("保存後にGoogleアカウントが切り替わりました。/,
  'Cloud upload completion must reject an intervening account switch even if the same UID is active again.');
assert.match(sync, /await uploadQueue;[\s\S]*?getDoc\(cloudRef\(uid\)\)/,
  'Manual cloud reads must wait for queued uploads and stop if a preceding upload failed.');
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
const downloadStart = sync.indexOf('async function downloadCloud()');
const downloadEnd = sync.indexOf('async function syncNow()', downloadStart);
assert.ok(downloadStart >= 0 && downloadEnd > downloadStart, 'Manual cloud download function must exist.');
const download = sync.slice(downloadStart, downloadEnd);
assert.match(download, /if \(!confirm\([\s\S]*?return false;\s*if \(!isCurrentAccount\(\)\)[\s\S]*?if \(!navigator\.onLine\)[\s\S]*?roomLocalSnapshotMatches\(localSnapshot\)[\s\S]*?const latestSnapshot = await getDoc\(cloudRef\(uid\)\);[\s\S]*?sameRoomCloudVersion\(snapshot, latestSnapshot\)[\s\S]*?applyCloudDataSafely\(latestData\);/,
  'Cloud download must recheck account, connectivity, local state, and cloud version after confirmation before replacing local data.');
const firstSyncStart = sync.indexOf('async function syncNow()');
const firstSync = sync.slice(firstSyncStart);
assert.match(firstSync, /if \(useCloud\) \{[\s\S]*?if \(!isCurrentAccount\(\)\) throw new Error\("確認中にGoogleアカウントが切り替わりました。端末内データは変更していません。"\);\s*if \(!navigator\.onLine\) throw new Error\("確認中に通信が切れたため、クラウドデータの反映を中止しました。端末内データはそのままです。"\);[\s\S]*?roomLocalSnapshotMatches\(localSnapshot\)[\s\S]*?const latestSnapshot = await getDoc\(cloudRef\(uid\)\);[\s\S]*?sameRoomCloudVersion\(snapshot, latestSnapshot\)[\s\S]*?applyCloudDataSafely\(latestData\);/,
  'First-sync cloud import must recheck account, connectivity, local state, and cloud version after confirmation before replacing local data.');
assert.match(sync, /window\.addEventListener\("online"/,
  'Cloud sync must be reconsidered after connectivity returns.');
assert.match(sync, /document\.addEventListener\("visibilitychange"/,
  'Returning to the app must check for pending cloud changes.');
assert.match(sync, /if \(syncInProgress\) \{\s*syncPending = true;/,
  'Automatic sync requests must be deferred while another sync is active.');
assert.match(sync, /logoutInProgress = true;[\s\S]*?await uploadQueue\.catch[\s\S]*?await signOut\(auth\)/,
  'Logout must stop new syncs and wait for queued uploads before signing out.');
assert.match(sync, /logoutInProgress = true;[\s\S]*?clearTimeout\(syncRetryTimer\);\s*syncRetryTimer = null;\s*syncRetryCount = 0;\s*syncPending = false;[\s\S]*?await uploadQueue\.catch/,
  'Starting logout must cancel pending automatic retries and clear pending sync work before waiting for uploads.');
assert.match(sync, /const logoutUser = currentUser;[\s\S]*?const logoutUid = logoutUser\.uid;[\s\S]*?const logoutGeneration = authStateGeneration;[\s\S]*?await uploadQueue\.catch[\s\S]*?if \(!currentUser \|\| currentUser\.uid !== logoutUid \|\| authStateGeneration !== logoutGeneration\) return;[\s\S]*?await signOut\(auth\)/,
  'Logout must confirm the original account identity and generation after waiting for queued uploads.');
assert.match(sync, /const logoutGeneration = authStateGeneration;[\s\S]*?if \(!currentUser \|\| currentUser\.uid !== logoutUid \|\| authStateGeneration !== logoutGeneration\) return;[\s\S]*?await signOut\(auth\)/,
  'Logout must reject stale work even if the same UID becomes active again after an intervening account switch.');
assert.match(sync, /catch \(error\) \{\s*if \(!currentUser \|\| currentUser\.uid !== logoutUid \|\| authStateGeneration !== logoutGeneration\) return;/,
  'A stale logout error must not overwrite status after a rapid account switch.');
assert.match(sync, /catch \(error\) \{\s*if \(!currentUser \|\| currentUser\.uid !== logoutUid \|\| authStateGeneration !== logoutGeneration\) return;\s*status\("ログアウトできません："/,
  'A logout failure from an old account generation must not overwrite the current account status.');
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

const loginStart = sync.indexOf('loginButton.addEventListener("click"');
const loginEnd = sync.indexOf('syncButton.addEventListener("click"', loginStart);
assert.ok(loginStart >= 0 && loginEnd > loginStart, 'Google login click handler must exist.');
const loginHandler = sync.slice(loginStart, loginEnd);
assert.match(loginHandler, /const loginGeneration = authStateGeneration;/,
  'Each Google login attempt must capture the current authentication generation.');
assert.match(loginHandler, /catch \(error\) \{\s*if \(authStateGeneration !== loginGeneration\) return;/,
  'A stale Google popup failure must not overwrite a newer authentication state.');
assert.match(loginHandler, /catch \(redirectError\) \{\s*if \(authStateGeneration !== loginGeneration\) return;/,
  'A stale Google redirect failure must not overwrite a newer authentication state.');

const authChangeStart = sync.indexOf('onAuthStateChanged(auth, user =>');
const authChangeEnd = sync.indexOf('window.addEventListener("offline"', authChangeStart);
assert.ok(authChangeStart >= 0 && authChangeEnd > authChangeStart,
  'Firebase auth change handler must be bounded before network event handlers.');
const authChangeHandler = sync.slice(authChangeStart, authChangeEnd);
assert.match(authChangeHandler, /if \(currentUser\?\.uid !== user\?\.uid\) \{[\s\S]*?clearTimeout\(window\.__kokoroSyncTimer\)[\s\S]*?clearTimeout\(syncRetryTimer\)[\s\S]*?syncRetryCount = 0;[\s\S]*?syncPending = false;[\s\S]*?initializedSyncForUid = null;/,
  'An account change must cancel old scheduled uploads and retries and reset per-account sync state.');
assert.match(authChangeHandler, /authStateGeneration \+= 1;/,
  'Every authentication identity transition must advance a generation counter, including rapid switches back to a prior UID.');
const offlineStart = sync.indexOf('window.addEventListener("offline"');
const onlineStart = sync.indexOf('window.addEventListener("online"', offlineStart);
const visibilityStart = sync.indexOf('document.addEventListener("visibilitychange"', onlineStart);
assert.ok(offlineStart >= 0 && onlineStart > offlineStart && visibilityStart > onlineStart,
  'Offline, online, and visibility handlers must remain present and ordered.');
const offlineHandler = sync.slice(offlineStart, onlineStart);
assert.match(offlineHandler, /clearTimeout\(syncRetryTimer\);[\s\S]*?syncRetryTimer = null;/,
  'Going offline must cancel a pending cloud retry timer.');
assert.match(offlineHandler, /if \(syncRetryTimer\) \{\s*clearTimeout\(syncRetryTimer\);\s*syncRetryTimer = null;\s*syncRetryCount = Math\.max\(0, syncRetryCount - 1\);/,
  'Canceling a scheduled retry because the device went offline must restore the unused retry slot.');
const onlineHandler = sync.slice(onlineStart, visibilityStart);
assert.match(onlineHandler, /if \(!currentUser\) \{[\s\S]*?return;[\s\S]*?queueSync\(\);/,
  'Coming back online must retry only when a user is signed in.');
assert.match(onlineHandler, /clearTimeout\(syncRetryTimer\);\s*syncRetryTimer = null;\s*syncRetryCount = 0;[\s\S]*?queueSync\(\);/,
  'Returning online after exhausting automatic retries must reset the retry budget and start a fresh retry cycle.');
const visibilityHandler = sync.slice(visibilityStart);
assert.match(visibilityHandler, /document\.visibilityState !== "visible" \|\| !currentUser[\s\S]*?const uid = currentUser\.uid[\s\S]*?initializedSyncForUid === uid[\s\S]*?queueSync\(\);/,
  'Returning to the app must check sync state against the currently signed-in UID.');


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
assert.ok((sns.match(/finally \{ snsReleaseBusyFor\(user, operationGeneration\); \}/g) || []).length >= 5,
  'SNS profile, post, report, and refresh operations must use generation-scoped busy cleanup.');
assert.match(sns, /let snsBusyGeneration = 0;[\s\S]*?function snsSetBusy\(value\) \{\s*snsBusyGeneration \+= 1;[\s\S]*?return snsBusyGeneration;[\s\S]*?function snsReleaseBusyFor\(user, operationGeneration\) \{[\s\S]*?snsUser\?\.uid === user\.uid && snsBusyGeneration === operationGeneration\) snsSetBusy\(false\);/,
  'A stale SNS request must not unlock a newer operation, including after a same-UID sign-out/sign-in cycle.');
assert.match(sns, /finally \{ snsReleaseBusyFor\(activeUser, operationGeneration\); \}/,
  'Unblocking must release its busy state only for the exact operation that started it.');
assert.match(sns, /finally \{\s*snsReleaseBusyFor\(user, operationGeneration\);\s*\}/,
  'Post edits and deletions must release their busy state only for the exact operation that started them.');
assert.match(sns, /const response = await fetch\(path,[\s\S]*?if \(!snsUser \|\| snsUser\.uid !== user\.uid\) throw new Error\("アカウントが切り替わりました。"\);[\s\S]*?const data = await response\.json\(\)/,
  'Admin API responses must be discarded if the signed-in account changes while the request is in flight.');
assert.match(sns, /const user = snsUser;\s*const authGeneration = snsAuthGeneration;\s*if \(!user \|\| snsAdminPanel\.hidden\) return;\s*try \{\s*await snsLoadAdminReports\(user, snsAdminFilter\.value \|\| "pending", authGeneration\);\s*\} catch \(error\) \{\s*if \(!snsUser \|\| snsUser\.uid !== user\.uid \|\| snsAuthGeneration !== authGeneration\) return;/,
  'Admin report refresh failures must be scoped to the account that started the request.');
assert.match(sns, /const accountChanged = snsUser\?\.uid !== user\?\.uid/,
  'SNS must detect account changes before showing account-specific content.');
assert.match(sns, /if \(accountChanged\) \{[\s\S]*?snsNickname\.value = ""[\s\S]*?snsRenderPosts\(\[\]\)[\s\S]*?snsBlockList\.replaceChildren\(\)[\s\S]*?snsBlockUid\.value = ""[\s\S]*?snsReportUid\.value = ""/,
  'SNS must clear private profile, post, block, and report form data on account changes.');
assert.match(sns, /let snsAuthGeneration = 0;[\s\S]*?onAuthStateChanged\(getAuth\(snsApp\), async user => \{\s*const authGeneration = \+\+snsAuthGeneration;/,
  'Every SNS auth-state callback must receive a fresh generation, including same-UID sign-in cycles.');
for (const [loader, firstUiWrite] of [
  ['snsLoadProfile', 'snsNickname.value ='],
  ['snsLoadPosts', 'snsRenderPosts(posts)'],
  ['snsLoadBlocks', 'snsBlockList.replaceChildren()']
]) {
  const loaderStart = sns.indexOf('async function ' + loader + '(user, authGeneration = snsAuthGeneration)');
  const loaderEnd = sns.indexOf('\n}', loaderStart);
  assert.ok(loaderStart >= 0 && loaderEnd > loaderStart, loader + ' must exist.');
  const loaderSource = sns.slice(loaderStart, loaderEnd);
  const awaitedRead = loaderSource.indexOf('await ');
  const generationGuard = loaderSource.indexOf('snsAuthGeneration !== authGeneration');
  const uiWrite = loaderSource.indexOf(firstUiWrite);
  assert.ok(awaitedRead >= 0 && generationGuard > awaitedRead && uiWrite > generationGuard,
    loader + ' must verify the auth generation after its asynchronous read and before updating the UI.');
}
const loginHandlerStart = html.indexOf('loginButton.addEventListener("click"');
const loginHandlerEnd = html.indexOf('syncButton.addEventListener("click", syncNow)', loginHandlerStart);
assert.ok(loginHandlerStart >= 0 && loginHandlerEnd > loginHandlerStart,
  'Google login click handler must exist.');
const googleLoginHandler = html.slice(loginHandlerStart, loginHandlerEnd);
assert.match(googleLoginHandler, /if \(logoutInProgress \|\| loginInProgress\) return;[\s\S]*?loginInProgress = true;[\s\S]*?loginButton\.disabled = true;/,
  'Google login must ignore duplicate clicks and disable the button while authentication is starting.');
assert.match(googleLoginHandler, /finally \{\s*loginInProgress = false;\s*loginButton\.disabled = !!currentUser \|\| !navigator\.onLine \|\| logoutInProgress;/,
  'Google login must release its in-progress lock and restore the button state after popup or redirect failure.');
assert.match(googleLoginHandler, /const startRedirect = async \(\) => \{[\s\S]*?await signInWithRedirect\(auth, provider\);[\s\S]*?catch \(error\) \{\s*try \{ sessionStorage\.removeItem\("kokoroReturnToAiAfterLogin"\); \} catch \(storageError\) \{\}[\s\S]*?throw error;/,
  'A failed redirect must clear the pending return-to-AI marker before a later login attempt.');
const uploadLocalStart = html.indexOf('async function uploadLocal(uid = currentUser?.uid)');
const uploadLocalEnd = html.indexOf('\nasync function downloadCloud()', uploadLocalStart);
assert.ok(uploadLocalStart >= 0 && uploadLocalEnd > uploadLocalStart, 'Cloud upload operation must exist.');
const uploadLocalOperation = html.slice(uploadLocalStart, uploadLocalEnd);
assert.match(uploadLocalOperation, /if \(!uid \|\| !currentUser \|\| currentUser\.uid !== uid\) throw new Error/,
  'Cloud uploads must reject a UID that is not the active account before queueing.');
assert.match(uploadLocalOperation, /uploadQueue\.catch\(\(\) => \{\}\)\.then\(async \(\) => \{\s*if \(!currentUser \|\| currentUser\.uid !== uid \|\| authStateGeneration !== generation\) throw new Error/,
  'Queued cloud uploads must re-check the active account and generation immediately before reading local data and writing.');
assert.match(uploadLocalOperation, /uploadQueue\.catch\(\(\) => \{\}\)\.then\(async \(\) => \{[\s\S]*?const payload = localPayload\(\);\s*await setDoc\(cloudRef\(uid\),/,
  'Cloud upload payloads must be read only when their serialized queue task starts, so edits made while an earlier upload is running are included by the next upload.');
assert.match(uploadLocalOperation, /await setDoc\(cloudRef\(uid\),[\s\S]*?if \(!currentUser \|\| currentUser\.uid !== uid \|\| authStateGeneration !== generation\) throw new Error/,
  'Cloud upload completion must verify the originating account and generation before reporting success.');

const queueSyncStart = html.indexOf('function queueSync()');
const queueSyncEnd = html.indexOf('\ntry {', queueSyncStart);
assert.ok(queueSyncStart >= 0 && queueSyncEnd > queueSyncStart, 'Automatic cloud sync queue must exist.');
const queueSyncHandler = html.slice(queueSyncStart, queueSyncEnd);
assert.ok(queueSyncHandler.includes('const queuedUid = currentUser.uid;') &&
  queueSyncHandler.includes('const queuedGeneration = authStateGeneration;') &&
  queueSyncHandler.includes('if (!currentUser || currentUser.uid !== queuedUid || authStateGeneration !== queuedGeneration) return;'),
  'Delayed automatic sync must stop when the originating account or authentication generation changes.');
assert.ok(queueSyncHandler.includes('if (currentUser && currentUser.uid === queuedUid && authStateGeneration === queuedGeneration) {') &&
  queueSyncHandler.includes('if (currentUser && currentUser.uid === queuedUid && authStateGeneration === queuedGeneration && !logoutInProgress) queueSync();'),
  'Automatic sync success notices and retries must remain scoped to the originating account generation.');
assert.match(queueSyncHandler, /await uploadLocal\(queuedUid\);[\s\S]*?clearTimeout\(syncRetryTimer\);\s*syncRetryTimer = null;\s*syncRetryCount = 0;\s*status\("自動同期しました。"\)/,
  'A successful automatic upload must clear any pending retry and reset the retry budget.');
assert.match(queueSyncHandler, /if \(logoutInProgress\) return;\s*status\("クラウド同期に失敗しました[\s\S]*?if \(!navigator\.onLine\) \{[\s\S]*?通信が切れました[\s\S]*?\} else if \(syncRetryCount < 3\) \{\s*const delay = \[3000, 10000, 30000\]\[syncRetryCount\+\+\];[\s\S]*?syncRetryTimer = setTimeout/,
  'A failed automatic upload must not overwrite logout status or schedule retries during logout; offline failures must not consume retry slots.');
assert.match(queueSyncHandler, /else \{\s*status\("自動再試行を3回行いました/,
  'The exhausted retry message must remain limited to the three-retry case after offline and logout paths are excluded.');

const downloadCloudStart = html.indexOf('async function downloadCloud()');
const downloadCloudEnd = html.indexOf('\nasync function syncNow()', downloadCloudStart);
assert.ok(downloadCloudStart >= 0 && downloadCloudEnd > downloadCloudStart, 'Cloud download operation must exist.');
const downloadCloudOperation = html.slice(downloadCloudStart, downloadCloudEnd);
assert.match(downloadCloudOperation, /const generation = authStateGeneration;[\s\S]*?const isCurrentAccount = \(\) => !!currentUser && currentUser\.uid === uid && authStateGeneration === generation;/,
  'Cloud downloads must capture the authentication generation to reject rapid account switches.');
assert.match(downloadCloudOperation, /if \(!isCurrentAccount\(\)\) throw new Error\("確認中にGoogleアカウントが切り替わりました。端末内データは変更していません。"\);\s*if \(!navigator\.onLine\) throw new Error\("確認中に通信が切れたため、クラウドデータの反映を中止しました。端末内データはそのままです。"\);\s*applyCloudDataSafely\(data\);/,
  'Cloud data must not be applied after the account changes during the confirmation prompt, including A-to-B-to-A switches.');
assert.match(downloadCloudOperation, /markCloudSync\(uid\);\s*clearTimeout\(syncRetryTimer\);\s*syncRetryTimer = null;\s*syncRetryCount = 0;/,
  'A successful cloud download must cancel stale automatic retries and reset the retry budget.');

const syncNowStart = html.indexOf('async function syncNow()');
const syncNowEnd = html.indexOf('\nfunction queueSync()', syncNowStart);
assert.ok(syncNowStart >= 0 && syncNowEnd > syncNowStart, 'Manual cloud sync handler must exist.');
const syncNowHandler = html.slice(syncNowStart, syncNowEnd);
assert.match(syncNowHandler, /const generation = authStateGeneration;[\s\S]*?const isCurrentAccount = \(\) => !!currentUser && currentUser\.uid === uid && authStateGeneration === generation;/,
  'Manual sync must capture the authentication generation to reject rapid account switches.');
assert.match(syncNowHandler, /catch \(error\) \{\s*if \(!isCurrentAccount\(\)\) return;/,
  'A failed manual sync must not show an old account error after an account switch.');
assert.match(syncNowHandler, /markCloudSync\(uid\);\s*clearTimeout\(syncRetryTimer\);\s*syncRetryTimer = null;\s*syncRetryCount = 0;/,
  'A successful manual sync must cancel stale automatic retries and reset the retry budget.');
const downloadHandlerStart = html.indexOf('downloadButton.addEventListener("click"');
const downloadHandlerEnd = html.indexOf('logoutButton.addEventListener("click"', downloadHandlerStart);
assert.ok(downloadHandlerStart >= 0 && downloadHandlerEnd > downloadHandlerStart, 'Cloud download click handler must exist.');
const downloadHandler = html.slice(downloadHandlerStart, downloadHandlerEnd);
assert.match(downloadHandler, /const user = currentUser;[\s\S]*?const generation = authStateGeneration;[\s\S]*?if \(!currentUser \|\| currentUser\.uid !== user\.uid \|\| authStateGeneration !== generation\) return;/,
  'A failed cloud download must not overwrite the status after an account switch, including a rapid return to the same UID.');
const downloadStart = html.indexOf('async function downloadCloud()');
const downloadEnd = html.indexOf('\nasync function syncNow()', downloadStart);
assert.ok(downloadStart >= 0 && downloadEnd > downloadStart, 'Cloud download operation must exist.');
const downloadOperation = html.slice(downloadStart, downloadEnd);

const syncOperationStart = html.indexOf('async function syncNow()');
const syncOperationEnd = html.indexOf('\nfunction queueSync()', syncOperationStart);
assert.ok(syncOperationStart >= 0 && syncOperationEnd > syncOperationStart, 'Manual cloud sync operation must exist.');
const syncOperation = html.slice(syncOperationStart, syncOperationEnd);
assert.match(syncOperation, /await uploadQueue;\s*if \(!isCurrentAccount\(\)\)[\s\S]*?const snapshot = await getDoc\(cloudRef\(uid\)\)/,
  'Manual cloud sync must stop when a preceding local upload failed instead of proceeding to cloud reads or writes.');
assert.doesNotMatch(syncOperation, /await uploadQueue\.catch\(\(\) => \{\}\)/,
  'Manual cloud sync must not swallow pending upload failures.');

assert.match(downloadOperation, /await uploadQueue;\s*if \(!isCurrentAccount\(\)\)[\s\S]*?const snapshot = await getDoc\(cloudRef\(uid\)\)/,
  'Cloud download must stop if a pending local upload failed instead of silently continuing to replace local data with cloud data.');
assert.doesNotMatch(downloadOperation, /await uploadQueue\.catch\(\(\) => \{\}\)/,
  'Cloud download must not swallow pending upload failures before a potentially destructive import.');


const adminFilterStart = sns.indexOf('snsAdminFilter.addEventListener("change"');
const adminFilterEnd = sns.indexOf('if (snsApp)', adminFilterStart);
assert.ok(adminFilterStart >= 0 && adminFilterEnd > adminFilterStart,
  'Admin report filter handler must exist.');
const adminFilterHandler = sns.slice(adminFilterStart, adminFilterEnd);
assert.ok(adminFilterHandler.includes('const user = snsUser;') &&
  adminFilterHandler.includes('const authGeneration = snsAuthGeneration;') &&
  adminFilterHandler.includes('if (!snsUser || snsUser.uid !== user.uid || snsAuthGeneration !== authGeneration) return;') &&
  adminFilterHandler.includes('snsLoadAdminReports(user, snsAdminFilter.value || "pending", authGeneration)'),
  'Admin report filter failures and results must be scoped to the exact auth generation that started the request.');
const adminActionStart = sns.indexOf('if (report.status === "pending")');
const adminActionEnd = sns.indexOf('actions.appendChild(button)', adminActionStart);
assert.ok(adminActionStart >= 0 && adminActionEnd > adminActionStart,
  'Admin report action handler must exist.');
const adminActionHandler = sns.slice(adminActionStart, adminActionEnd);
assert.ok(adminActionHandler.includes('const authGeneration = snsAuthGeneration;') &&
  adminActionHandler.includes('if (!snsUser || snsUser.uid !== user.uid || snsAuthGeneration !== authGeneration) return;') &&
  adminActionHandler.includes('snsAdminUpdatingReports.has(report.id)') &&
  adminActionHandler.includes('snsAdminUpdatingReports.delete(report.id)'),
  'Admin report action failures must not alter controls after an account switch.');

for (const [guard, failure] of [
  ['if (!snsUser || snsUser.uid !== activeUser.uid) return;', 'console.error("SNS unblock failed", error);'],
  ['if (!snsUser || snsUser.uid !== user.uid) return;', 'console.error("SNS post edit failed", error);'],
  ['if (!snsUser || snsUser.uid !== user.uid) return;', 'console.error("SNS post delete failed", error);'],
  ['if (!snsUser || snsUser.uid !== user.uid || snsAuthGeneration !== authGeneration) return;', 'console.error("SNS block failed", error);'],
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
