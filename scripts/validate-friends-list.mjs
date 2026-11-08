import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync('index.html', 'utf8');
const rules = readFileSync('firestore.rules', 'utf8');

assert.match(html, /id="snsFriendList"/, 'A dedicated accepted-friends list must exist.');
assert.match(html, /const snsFriendList = document\.getElementById\("snsFriendList"\)/, 'The friends list must be wired to the UI.');
assert.match(html, /const acceptedRequests = \[/, 'Accepted requests from both directions must be combined.');
assert.match(html, /const friendRows = new Map\(acceptedRequests\.map\(item => \[item\.peerUid, item\]\)\)/, 'Friend entries must be deduplicated by peer UID.');
assert.match(html, /peerProfiles\.set\(uid, profile\.data\(\)\)/, 'Friend display may use the peer public profile.');
assert.match(html, /friendAvatarEmojis\[profile\?\.avatarId\]/, 'Only the predefined avatar mapping may be rendered.');
assert.match(html, /label\.textContent = \(friendAvatarEmojis\[profile\?\.avatarId\] \|\| "👤"\) \+ " " \+ \(peerNames\.get\(peerUid\)/, 'Friend names and avatars must be rendered as text.');
assert.match(html, /removeFriend\.addEventListener\("click", \(\) => snsRemoveFriend\(item\.snap\.id\)\)/, 'The list must reuse the existing friend-removal flow.');
assert.match(html, /snsFriendList\.replaceChildren\(\)/, 'The friend list must be cleared when refreshing and switching accounts.');
assert.match(rules, /match \/friendRequests\/{requestId}/, 'Friend request access rules must remain present.');
assert.match(rules, /resource\.data\.status\s*==\s*"accepted"/, 'Friend-only access must depend on an accepted request.');
console.log('Accepted friends list UI and relationship access checks passed.');
