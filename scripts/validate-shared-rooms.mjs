import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync('index.html', 'utf8');
const rules = readFileSync('firestore.rules', 'utf8');
const tests = readFileSync('tests/firestore.rules.test.mjs', 'utf8');

assert.match(html, /id="snsShareRoomSource"/);
assert.match(html, /window\.savedRoomData\?\.\(\)/, "Saved local rooms must be available as share sources.");
assert.match(html, /roomSource\.startsWith\("saved:"\)/, "A saved room must be shareable without replacing the current room.");
assert.match(html, /id="snsShareRoomFriend"/);
assert.match(html, /id="snsShareCurrentRoom"/);
assert.match(html, /id="snsSharedRoomList"/);
assert.match(html, /id="snsRefreshSharedRooms"/);
assert.match(html, /friendOption\.value = peerUid/);
assert.match(html, /window\.validRoomData\(currentRoom\)/);
assert.match(html, /new TextEncoder\(\)\.encode\(JSON\.stringify\(currentRoom\)\)\.length > 700000/);
assert.match(html, /batch\.set\(shareRef, snapshot\)/);
assert.match(html, /batch\.set\(doc\(snsDb, "users", user\.uid, "sharedRooms", shareRef\.id\), snapshot\)/);
assert.match(html, /collection\(snsDb, "users", user\.uid, "sharedRooms"\), limit\(50\)/);
assert.match(html, /where\("recipientUid", "==", user\.uid\),\s*where\("ownerUid", "==", peerUid\)/);
assert.match(html, /window\.applyRoom\?\.\(item\.currentRoom\)/);
assert.match(html, /batch\.delete\(doc\(snsDb, "sharedRooms", item\.id\)\)/);
assert.match(html, /batch\.delete\(doc\(snsDb, "users", user\.uid, "sharedRooms", item\.id\)\)/);
assert.match(html, /batch\.delete\(doc\(snsDb, "users", item\.recipientUid, "receivedSharedRooms", item\.id\)\)/);
assert.match(html, /setDoc\(doc\(snsDb, "users", user\.uid, "hiddenSharedRooms", item\.id\)/,
  'Recipients must hide incoming shares locally instead of deleting the owner\'s shared copy.');
assert.match(html, /snsLoadSharedRooms\(user, authGeneration\)/);
assert.match(html, /const revokedShares = new Map\(\)/, 'Blocking a user must collect their shared room snapshots for revocation.');
assert.match(html, /cleanupBatch\.delete\(doc\(snsDb, "users", share\.ownerUid, "sharedRooms", shareId\)\)/, 'Blocking must remove both sides of shared room snapshots.');
assert.match(html, /snsSharedRoomList\.replaceChildren\(\);\s*snsRoomShareStatus\.textContent = user \?/);

assert.match(rules, /match \/sharedRooms\/{shareId}/);
assert.match(rules, /match \/users\/{userId}\/sharedRooms\/{shareId}/);
assert.match(rules, /allow list: if signedIn\(\)\s*&& resource\.data\.recipientUid == request\.auth\.uid\s*&& !blockedBetween\(request\.auth\.uid, resource\.data\.ownerUid\);/);
assert.match(rules, /allow get, list: if owns\(userId\);/);
assert.match(rules, /allow delete: if signedIn\(\)\s*&& \(!exists\([\s\S]*?owns\(userId\)[\s\S]*?resource\.data\.recipientUid == request\.auth\.uid[\s\S]*?!acceptedFriend\(resource\.data\.ownerUid, resource\.data\.recipientUid\)[\s\S]*?blockedBetween\(resource\.data\.ownerUid, resource\.data\.recipientUid\)/, 'Recipients may remove an owner mirror only after access ends or blocking.');
assert.match(rules, /acceptedFriend\(request\.auth\.uid, request\.resource\.data\.recipientUid\)/);
assert.match(rules, /!blockedBetween\(request\.auth\.uid, request\.resource\.data\.recipientUid\)/);
assert.match(rules, /request\.resource\.data\.keys\(\)\.hasOnly\(\['ownerUid', 'recipientUid', 'title', 'currentRoom', 'createdAt'\]\)/);
assert.match(rules, /request\.resource\.data\.currentRoom\.items\.size\(\) <= 300/);
assert.match(rules, /allow update: if false;/);
assert.match(tests, /describe\('shared room snapshots'/);
assert.match(tests, /allows only the owner and recipient to read their shared snapshot/);
assert.match(tests, /allows an owner to create a bounded snapshot only for an accepted friend/);
assert.match(tests, /lets recipients clean up both copies after access ends and owners revoke their own shares/);
console.log('Shared room UI, owner mirrors, recipient access, snapshot limits, and emulator test coverage passed.');

assert.match(html, /保存済みのお部屋にコピー/);
assert.match(html, /window\.saveSavedRoomsWithUndo\?\.\(nextRooms\)/);
assert.match(html, /window\.validSavedRooms\?\.\(nextRooms\)/);
assert.match(html, /Object\.keys\(savedRooms\)\.length >= 100/);

assert.match(html, /async function snsRemoveFriend\(requestId\)[\s\S]*?const peerUid = requestData\.fromUid === user\.uid/);
assert.match(html, /snsFriendNotice\.textContent = roomCleanupComplete && shoppingShareRemoved\s*\?\s*"友達関係を解除し、この相手との共有ルームと買い物共有データも削除しました。"/);
assert.match(html, /receivedShares\.docs\.filter\(snap => snap\.data\(\)\.ownerUid === peerUid\)/);

assert.match(html, /const batch = writeBatch\(snsDb\);\s*batch\.delete\(doc\(snsDb, "friendRequests", requestId\)\);[\s\S]*?await batch\.commit\(\);/, "Friendship and shared-room removal must commit atomically.");

assert.match(html, /collection\(snsDb, "users", user\.uid, "sharedRooms"\),\s*where\("recipientUid", "==", peerUid\)/);
assert.match(html, /collection\(snsDb, "sharedRooms"\),\s*where\("recipientUid", "==", user\.uid\),\s*where\("ownerUid", "==", peerUid\)/);

assert.match(html, /snsAddBlock\.addEventListener\("click",[\s\S]*?const batch = writeBatch\(snsDb\);\s*batch\.set\(doc\(snsDb, "users", user\.uid, "blocks", targetUid\)/, "Blocking and share revocation must be atomic.");

assert.match(html, /if \(!snsUser \|\| snsUser\.uid !== user\.uid \|\| snsAuthGeneration !== authGeneration\) return;\s*console\.error\("SNS block failed"/);

assert.match(html, /removeShare\.addEventListener\("click", async \(\) => \{\s*if \(!snsUser \|\| snsUser\.uid !== user\.uid \|\| snsAuthGeneration !== authGeneration \|\| snsBusy\) return;[\s\S]*?const operationGeneration = snsSetBusy\(true\);[\s\S]*?snsReleaseBusyFor\(user, operationGeneration\);/);
assert.match(html, /if \(!snsUser \|\| snsUser\.uid !== user\.uid \|\| snsAuthGeneration !== authGeneration\) return;\s*console\.error\("Shared room removal failed"/);

assert.match(html, /getDocs\(query\(collection\(snsDb, "users", user\.uid, "sharedRooms"\), limit\(50\)\)\)/);
assert.match(html, /if \(ownerShares\.size >= 50\) throw new Error\("共有できるお部屋は50件までです。不要な共有を解除してください。"\)/);
assert.doesNotMatch(html, /where\("recipientUid", "==", recipientUid\)/, "Share creation must not read another user's private received-share list.");
