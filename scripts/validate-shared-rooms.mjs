import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync('index.html', 'utf8');
const rules = readFileSync('firestore.rules', 'utf8');
const tests = readFileSync('tests/firestore.rules.test.mjs', 'utf8');

assert.match(html, /id="snsShareRoomFriend"/, 'A friend selector must exist for room sharing.');
assert.match(html, /id="snsShareCurrentRoom"/, 'A share-current-room control must exist.');
assert.match(html, /id="snsSharedRoomList"/, 'A shared room list must exist.');
assert.match(html, /id="snsRefreshSharedRooms"/, 'A shared room refresh control must exist.');
assert.match(html, /friendOption\.value = peerUid/, 'Only accepted friends from the accepted friend list may be selectable.');
assert.match(html, /window\.validRoomData\(currentRoom\)/, 'Room data must be validated before sharing.');
assert.match(html, /new TextEncoder\(\)\.encode\(JSON\.stringify\(currentRoom\)\)\.length > 700000/, 'Room snapshots must be bounded before upload.');
assert.match(html, /batch\.set\(shareRef, snapshot\)/, "The recipient snapshot must be written.");\nassert.match(html, /batch\.set\(doc\(snsDb, "users", user\.uid, "sharedRooms", shareRef\.id\), snapshot\)/, "The owner mirror must be written.");\nassert.match(html, /await addDoc\(collection\(snsDb, "sharedRooms"\)/, 'The share action must persist a snapshot.');
assert.match(html, /collection\(snsDb, "users", user\.uid, "sharedRooms"\), limit\(50\)/, 'Owners must load their own shared snapshots.');
assert.match(html, /where\("recipientUid", "==", user\.uid\), limit\(50\)/, 'Recipients must load snapshots shared with them.');
assert.match(html, /window\.applyRoom\?\.\(item\.currentRoom\)/, 'Importing a shared snapshot must use the existing validated room apply path.');
assert.match(html, /batch\.delete\(doc\(snsDb, "sharedRooms", item\.id\)\)/, "Revocation must delete the recipient snapshot.");\nassert.match(html, /batch\.delete\(doc\(snsDb, "users", user\.uid, "sharedRooms", item\.id\)\)/, "Revocation must delete the owner mirror.");\nassert.match(html, /await deleteDoc\(doc\(snsDb, "sharedRooms", item\.id\)\)/, 'Owners must be able to revoke a shared snapshot.');
assert.match(html, /snsLoadSharedRooms\(user, authGeneration\)/, 'Shared-room loading must be tied to the current auth generation.');
assert.match(rules, /match \/users\/{userId}\/sharedRooms\/{shareId}/, "Owners must have a private mirror collection.");\nassert.match(rules, /match \/sharedRooms\/{shareId}/, 'Shared room rules must be present.');
assert.match(rules, /acceptedFriend\(request\.auth\.uid, request\.resource\.data\.recipientUid\)/, 'Creation must require an accepted friend.');
assert.match(rules, /!blockedBetween\(request\.auth\.uid, request\.resource\.data\.recipientUid\)/, 'Creation must reject either-direction blocks.');
assert.match(rules, /request\.resource\.data\.keys\(\)\.hasOnly\(\['ownerUid', 'recipientUid', 'title', 'currentRoom', 'createdAt'\]\)/, 'Shared snapshots must have an allowlisted schema.');
assert.match(rules, /request\.resource\.data\.currentRoom\.items\.size\(\) <= 300/, 'Shared room furniture count must be bounded.');
assert.match(rules, /allow update: if false;/, 'Shared snapshots must be immutable.');
assert.match(rules, /allow delete: if signedIn\(\) && resource\.data\.ownerUid == request\.auth\.uid;/, 'Only the owner may revoke a snapshot.');
assert.match(tests, /describe\('shared room snapshots'/, 'Firestore emulator tests must cover shared rooms.');
assert.match(tests, /allows only the owner and recipient to read their shared snapshot/, 'Tests must cover read isolation.');
assert.match(tests, /allows an owner to create a bounded snapshot only for an accepted friend/, 'Tests must cover accepted-friend creation.');
assert.match(tests, /blocks either direction/, 'Tests must cover block-based access denial.');
console.log('Shared room UI, snapshot limits, ownership rules, and emulator test coverage passed.');

assert.match(html, /snsSharedRoomList\.replaceChildren\(\);\s*snsRoomShareStatus\.textContent = user \?/, "Shared room data must be cleared on account changes.");
