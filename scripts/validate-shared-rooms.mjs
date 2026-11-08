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
assert.match(html, /where\("recipientUid", "==", user\.uid\), limit\(50\)/);
assert.match(html, /window\.applyRoom\?\.\(item\.currentRoom\)/);
assert.match(html, /batch\.delete\(doc\(snsDb, "sharedRooms", item\.id\)\)/);
assert.match(html, /batch\.delete\(doc\(snsDb, "users", item\.ownerUid, "sharedRooms", item\.id\)\)/);
assert.match(html, /snsLoadSharedRooms\(user, authGeneration\)/);
assert.match(html, /const revokedShares = new Map\(\)/, 'Blocking a user must collect their shared room snapshots for revocation.');
assert.match(html, /batch\.delete\(doc\(snsDb, "users", share\.ownerUid, "sharedRooms", shareId\)\)/, 'Blocking must remove both sides of shared room snapshots.');
assert.match(html, /snsSharedRoomList\.replaceChildren\(\);\s*snsRoomShareStatus\.textContent = user \?/);

assert.match(rules, /match \/sharedRooms\/{shareId}/);
assert.match(rules, /match \/users\/{userId}\/sharedRooms\/{shareId}/);
assert.match(rules, /allow list: if signedIn\(\) && resource\.data\.recipientUid == request\.auth\.uid;/);
assert.match(rules, /allow get, list: if owns\(userId\);/);
assert.match(rules, /allow delete: if owns\(userId\) \|\| \(signedIn\(\) && resource\.data\.recipientUid == request\.auth\.uid\);/, 'Only the owner or named recipient may remove an owner mirror.');
assert.match(rules, /acceptedFriend\(request\.auth\.uid, request\.resource\.data\.recipientUid\)/);
assert.match(rules, /!blockedBetween\(request\.auth\.uid, request\.resource\.data\.recipientUid\)/);
assert.match(rules, /request\.resource\.data\.keys\(\)\.hasOnly\(\['ownerUid', 'recipientUid', 'title', 'currentRoom', 'createdAt'\]\)/);
assert.match(rules, /request\.resource\.data\.currentRoom\.items\.size\(\) <= 300/);
assert.match(rules, /allow update: if false;/);
assert.match(tests, /describe\('shared room snapshots'/);
assert.match(tests, /allows only the owner and recipient to read their shared snapshot/);
assert.match(tests, /allows an owner to create a bounded snapshot only for an accepted friend/);
assert.match(tests, /lets recipients remove both copies and owners revoke their own shares/);
console.log('Shared room UI, owner mirrors, recipient access, snapshot limits, and emulator test coverage passed.');

assert.match(html, /保存済みのお部屋にコピー/);
assert.match(html, /window\.saveSavedRoomsWithUndo\?\.\(nextRooms\)/);
assert.match(html, /window\.validSavedRooms\?\.\(nextRooms\)/);
assert.match(html, /Object\.keys\(savedRooms\)\.length >= 100/);
