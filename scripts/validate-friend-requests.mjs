import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync('index.html', 'utf8');
const rules = readFileSync('firestore.rules', 'utf8');
const tests = readFileSync('tests/firestore.rules.test.mjs', 'utf8');

for (const id of ['snsFriendUid', 'snsSendFriendRequest', 'snsFriendNotice', 'snsIncomingFriends', 'snsOutgoingFriends']) {
  assert.match(html, new RegExp('id="' + id + '"'), 'Friend request UI element is required: ' + id);
}
assert.match(html, /async function snsLoadFriendRequests\(/, 'Friend request lists must load after authentication.');
assert.match(html, /where\("toUid", "==", user\.uid\)/, 'Incoming requests must be scoped to the signed-in recipient.');
assert.match(html, /where\("fromUid", "==", user\.uid\)/, 'Outgoing requests must be scoped to the signed-in sender.');
assert.match(html, /snsAuthGeneration !== authGeneration/, 'Friend request results must not leak across account switches.');
assert.match(html, /snsDecideFriendRequest\(snap\.id, "accepted"\)/, 'Incoming requests must support acceptance.');
assert.match(html, /snsDecideFriendRequest\(snap\.id, "declined"\)/, 'Incoming requests must support declining.');
assert.match(html, /deleteDoc\(doc\(snsDb, "friendRequests", snap\.id\)\)/, 'Senders must be able to cancel pending requests.');
assert.match(html, /コメント投稿者を通報/, 'Comments must link to the existing report flow.');
assert.match(html, /コメント本文は送信されません/, 'Comment reporting must not silently transmit comment text.');
assert.match(rules, /match \/friendRequests\/\{requestId\}/, 'Friend request collection rules are required.');
assert.match(rules, /request\.resource\.data\.fromUid == request\.auth\.uid/, 'Request sender must match the authenticated UID.');
assert.match(rules, /resource\.data\.toUid == request\.auth\.uid/, 'Only the recipient may accept or decline.');
assert.match(rules, /!blockedBetween\(resource\.data\.fromUid, resource\.data\.toUid\)/, 'Block state must be checked before changing existing requests.');
assert.match(tests, /friend requests/, 'Firestore Emulator tests for friend requests are required.');
assert.match(tests, /rejects requests to private profiles/, 'Private-profile requests must be rejected in tests.');
assert.match(tests, /blocks requests in either direction/, 'Blocked requests must be rejected in tests.');

console.log('Friend request UI, account isolation, comment reporting, and Firestore authorization checks passed.');
