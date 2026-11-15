import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync('index.html', 'utf8');
const rules = readFileSync('firestore.rules', 'utf8');
const tests = readFileSync('tests/firestore.rules.test.mjs', 'utf8');
const f = readFileSync('functions/index.js', 'utf8');

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
assert.match(html, /targetCommentId: reportContext\.targetCommentId/, 'Comment reports must carry a comment reference.');
assert.match(html, /snsReportContext = \{ reportType: "comment"/, 'Comment report context must be explicitly selected.');
assert.match(f, /comment\?\.authorUid !== targetUid/, 'The server must verify the reported comment author.');
assert.match(f, /targetCommentId: data\.targetCommentId/, 'Admin review must receive the comment reference.');
assert.match(rules, /match \/friendRequests\/\{requestId\}/, 'Friend request collection rules are required.');
const friendRequestRuleStart = rules.indexOf('match /friendRequests/{requestId}');
const friendRequestRuleEnd = rules.indexOf('match /', friendRequestRuleStart + 10);
const friendRequestRules = rules.slice(friendRequestRuleStart, friendRequestRuleEnd > 0 ? friendRequestRuleEnd : undefined);
assert.match(friendRequestRules, /allow get: if signedIn\(\)[\s\S]*?resource\.data\.fromUid == request\.auth\.uid[\s\S]*?resource\.data\.toUid == request\.auth\.uid[\s\S]*?!blockedBetween/);
assert.doesNotMatch(friendRequestRules, /!exists\([\s\S]*?friendRequests\/\$\(requestId\)/,
  'Missing request documents must not be readable as an existence oracle.');
const sendRequestStart = html.indexOf('snsSendFriendRequest.addEventListener("click"');
const sendRequestEnd = html.indexOf('snsSubmitReport.addEventListener("click"', sendRequestStart);
assert.ok(sendRequestStart >= 0 && sendRequestEnd > sendRequestStart);
const sendRequestHandler = html.slice(sendRequestStart, sendRequestEnd);
assert.doesNotMatch(sendRequestHandler, /getDoc\(doc\(snsDb, "friendRequests"/,
  'Sending a request must not probe existing or missing request IDs.');
assert.match(sendRequestHandler, /setDoc\(doc\(snsDb, "friendRequests", user\.uid \+ "_" \+ targetUid\)/);
const removeFriendStart = html.indexOf('async function snsRemoveFriend(');
const removeFriendEnd = html.indexOf('async function snsLoadSharedRooms(', removeFriendStart);
const removeFriendHandler = html.slice(removeFriendStart, removeFriendEnd);
assert.match(removeFriendHandler, /where\("fromUid", "==", user\.uid\)/);
assert.match(removeFriendHandler, /where\("toUid", "==", user\.uid\)/);
assert.doesNotMatch(removeFriendHandler, /getDoc\(doc\(snsDb, "friendRequests",\s*(?:user\.uid\s*\+\s*"_".*peerUid|peerUid\s*\+\s*"_".*user\.uid)/,
  'Friend removal must use participant-scoped lists instead of probing both directional IDs.');
assert.match(rules, /request\.resource\.data\.fromUid == request\.auth\.uid/, 'Request sender must match the authenticated UID.');
assert.match(rules, /resource\.data\.toUid == request\.auth\.uid/, 'Only the recipient may accept or decline.');
const friendRequestListRuleStart = rules.indexOf('match /friendRequests/{requestId}');
const friendRequestListRuleEnd = rules.indexOf('allow create:', friendRequestListRuleStart);
assert.ok(friendRequestListRuleStart >= 0 && friendRequestListRuleEnd > friendRequestListRuleStart,
  'Friend request list rule must exist.');
const friendRequestListRule = rules.slice(friendRequestListRuleStart, friendRequestListRuleEnd);
assert.ok(friendRequestListRule.includes("allow list: if signedIn()")
  && friendRequestListRule.includes("resource.data.toUid == request.auth.uid")
  && friendRequestListRule.includes("resource.data.fromUid == request.auth.uid"),
  'Users may list only their own friend requests for cleanup and inbox display.');
assert.match(rules, /!blockedBetween\(resource\.data\.fromUid, resource\.data\.toUid\)/, 'Block state must be checked before changing existing requests.');
assert.match(tests, /friend requests/, 'Firestore Emulator tests for friend requests are required.');
assert.match(tests, /rejects requests to private profiles/, 'Private-profile requests must be rejected in tests.');
assert.match(tests, /blocks requests in either direction/, 'Blocked requests must be rejected in tests.');

console.log('Friend request UI, account isolation, comment reporting, and Firestore authorization checks passed.');
