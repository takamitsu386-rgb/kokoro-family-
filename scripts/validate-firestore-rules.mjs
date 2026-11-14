import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const rules = readFileSync('firestore.rules', 'utf8');
const firebaseConfig = JSON.parse(readFileSync('firebase.json', 'utf8'));

assert.equal(firebaseConfig.firestore?.rules, 'firestore.rules',
  'Firebase configuration must point to the reviewed Firestore rules file.');
assert.equal(firebaseConfig.emulators?.firestore?.port, 8080,
  'Firestore rules tests must use the dedicated local emulator port.');

assert.match(rules, /^rules_version\s*=\s*'2';/m, 'Firestore Rules v2 must be enabled.');
assert.match(rules, /}\s*}\s*$/, 'Firestore rules must end immediately after the documents and service blocks; trailing fragments are not allowed.');
assert.match(rules, /match\s+\/databases\/\{database\}\/documents\s*\{/,
  'Firestore database document scope is missing.');
assert.match(rules, /match\s+\/users\/\{userId\}\/kokoro\/\{documentId\}\s*\{/,
  'Existing private room-data path must remain explicitly scoped.');
assert.match(rules, /request\.auth\s*!=\s*null/,
  'Room data must require an authenticated user.');
assert.match(rules, /function\s+owns\(uid\)\s*\{\s*return\s+signedIn\(\)\s*&&\s*request\.auth\.uid\s*==\s*uid;/,
  'Owner helper must require authentication and match the requested UID.');
assert.match(rules, /match\s+\/users\/\{userId\}\/kokoro\/\{documentId\}\s*\{\s*allow\s+read,\s*write:\s*if\s+owns\(userId\)\s*&&\s*documentId\s+in\s+\["data",\s*"shopping"\];/s,
  'Room and personal shopping data must remain read/write for their owner only.');
assert.match(rules, /documentId\s+in\s+\["data",\s*"shopping"\]/,
  'Private cloud access must remain limited to the room and personal shopping documents.');

// Recipient-side share index stores identifiers only and remains owner-readable
// so a user can clean up stale shares after blocking the other account.
assert.match(rules, /match\s+\/users\/\{userId\}\/receivedSharedRooms\/\{shareId\}\s*\{/,
  'Recipient-side shared-room metadata path must be explicitly scoped.');
assert.match(rules, /match\s+\/users\/\{userId\}\/receivedSharedRooms\/\{shareId\}\s*\{[\s\S]*?allow\s+get,\s*list:\s*if\s+owns\(userId\)/,
  'Only the recipient may read their shared-room metadata index.');
assert.match(rules, /match\s+\/users\/\{userId\}\/receivedSharedRooms\/\{shareId\}\s*\{[\s\S]*?hasOnly\(\['ownerUid',\s*'recipientUid',\s*'createdAt'\]\)/,
  'Recipient-side shared-room index must contain metadata only.');
assert.match(rules, /match\s+\/users\/\{userId\}\/receivedSharedRooms\/\{shareId\}\s*\{[\s\S]*?existsAfter\([\s\S]*?getAfter\([\s\S]*?acceptedFriend\(request\.auth\.uid,\s*userId\)[\s\S]*?!blockedBetween\(request\.auth\.uid,\s*userId\)/,
  'Recipient metadata must be atomically linked to an accepted, unblocked shared-room creation.');
assert.match(rules, /match\s+\/users\/\{userId\}\/receivedSharedRooms\/\{shareId\}\s*\{[\s\S]*?allow\s+update:\s*if\s+false/,
  'Recipient-side shared-room metadata must not be editable.');
assert.match(rules, /match\s+\/profiles\/\{uid\}\s*\{/,
  'Profile access must remain explicitly scoped.');
assert.match(rules, /match\s+\/posts\/\{postId\}\s*\{/,
  'Post access must remain explicitly scoped.');
assert.match(rules, /function\s+validProfile\(/,
  'Profile field allowlist validation is required.');
assert.match(rules, /function\s+validPost\(/,
  'Post field allowlist validation is required.');
assert.match(rules, /function\s+acceptedFriend\(uidA, uidB\)/,
  'Friends-only access must depend on an accepted request in either direction.');
assert.match(rules, /function\s+canInteractWithPost\(postId\)/,
  'Interactions must validate parent post visibility and block status.');
assert.match(rules, /resource\.data\.visibility == 'friends'[\s\S]*?acceptedFriend\(request\.auth\.uid, resource\.data\.authorUid\)/,
  'Friends-only posts must require an accepted friend relationship.');
assert.match(rules, /resource\.data\.visibility == 'friends'[\s\S]*?acceptedFriend\(request\.auth\.uid, uid\)/,
  'Friends-only profiles must be visible only to accepted friends.');
assert.match(rules, /function\s+validComment\(data\)/,
  'Comment field and length validation is required.');
assert.match(rules, /match\s+\/friendRequests\/\{requestId\}/,
  'Friend request rules must be explicit.');
assert.equal([...rules.matchAll(/match\s+\/friendRequests\/\{requestId\}\s*\{/g)].length, 1,
  'Friend request access must be defined in exactly one match block to avoid overlapping allow rules.');
for (const [pattern, path] of [
  [/match\s+\/users\/\{userId\}\/blocks\/\{targetUid\}\s*\{/g, 'user block records'],
  [/match\s+\/profiles\/\{uid\}\s*\{/g, 'profiles'],
  [/match\s+\/posts\/\{postId\}\s*\{/g, 'posts'],
  [/match\s+\/comments\/\{commentId\}\s*\{/g, 'post comments'],
  [/match\s+\/likes\/\{likerUid\}\s*\{/g, 'post likes'],
  [/match\s+\/users\/\{userId\}\/aiUsage\/\{dayKey\}\s*\{/g, 'AI usage counters'],
  [/match\s+\/reports\/\{reportId\}\s*\{/g, 'reports'],
  [/match\s+\/users\/\{userId\}\/reportUsage\/\{dayKey\}\s*\{/g, 'report usage counters'],
  [/match\s+\/sharedRooms\/\{shareId\}\s*\{/g, 'shared room snapshots'],
  [/match\s+\/users\/\{userId\}\/sharedRooms\/\{shareId\}\s*\{/g, 'owner shared room mirrors'],
  [/match\s+\/users\/\{userId\}\/receivedSharedRooms\/\{shareId\}\s*\{/g, 'recipient shared room metadata'],
  [/match\s+\/users\/\{userId\}\/following\/\{targetUid\}\s*\{/g, 'following records']
]) {
  assert.equal([...rules.matchAll(pattern)].length, 1,
    `Firestore access for ${path} must be defined in exactly one match block.`);
}
assert.match(rules, /resource\.data\.toUid\s*==\s*request\.auth\.uid/,
  'Only the recipient may decide a friend request.');
assert.match(rules, /request\.resource\.data\.status\s+in\s+\['accepted',\s*'declined'\]/,
  'Friend request state transitions must be limited.');
assert.match(rules, /match\s+\/comments\/\{commentId\}/,
  'Comment rules must be explicit.');
assert.match(rules, /match\s+\/likes\/\{likerUid\}/,
  'Like rules must be explicit.');
assert.match(rules, /likerUid\s*==\s*request\.auth\.uid/,
  'A like document ID must be the authenticated UID.');
assert.match(rules, /data\.text\.size\(\)\s*<=\s*300/,
  'Comments must be limited to 300 characters.');
assert.match(rules, /match\s+\/users\/\{userId\}\/aiUsage\/\{dayKey\}\s*\{\s*allow\s+read,\s*write:\s*if\s+false;/,
  'AI usage counters must be explicitly inaccessible to clients.');
assert.doesNotMatch(rules, /match\s+\/\{document=\*\*\}/,
  'A recursive catch-all match could unintentionally expose new collections.');

console.log('Firestore access regression checks passed: existing room data remains owner-only; profile and post paths are explicitly scoped; unimplemented SNS paths remain denied.');
