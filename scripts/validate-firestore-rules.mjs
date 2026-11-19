import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const rules = readFileSync('firestore.rules', 'utf8');
const firebaseConfig = JSON.parse(readFileSync('firebase.json', 'utf8'));

assert.equal(firebaseConfig.firestore?.rules, 'firestore.rules');
assert.equal(firebaseConfig.emulators?.firestore?.port, 8080);
assert.match(rules, /^rules_version\s*=\s*'2';/m);
assert.match(rules, /match\s+\/databases\/\{database\}\/documents\s*\{/);
assert.match(rules, /match\s+\/users\/\{userId\}\/kokoro\/\{documentId\}\s*\{/);
assert.match(rules, /match\s+\/users\/\{userId\}\/kokoro\/\{documentId\}\s*\{\s*allow\s+read,\s*write:\s*if\s+owns\(userId\)\s*&&\s*documentId\s+in\s*\["data",\s*"shopping"\];/s,
  'Private room and personal shopping cloud sync must remain owner-only.');

for (const [pattern, label] of [
  [/match \/sharedShopping\/\{shareId\}\s*\{[\s\S]*?allow read, write: if false;/, 'friend-shared shopping'],
  [/match \/users\/\{userId\}\/blocks\/\{targetUid\}\s*\{[\s\S]*?allow read, write: if false;/, 'blocks'],
  [/match \/profiles\/\{uid\}\s*\{[\s\S]*?allow read, write: if false;/, 'profiles'],
  [/match \/posts\/\{postId\}\s*\{[\s\S]*?allow read, write: if false;/, 'posts, comments and likes'],
  [/match \/friendRequests\/\{requestId\}\s*\{[\s\S]*?allow read, write: if false;/, 'friend requests'],
  [/match \/users\/\{userId\}\/hiddenSharedRooms\/\{shareId\}\s*\{[\s\S]*?allow read, write: if false;/, 'hidden shared rooms'],
  [/match \/sharedRooms\/\{shareId\}\s*\{[\s\S]*?allow read, write: if false;/, 'shared rooms'],
  [/match \/users\/\{userId\}\/receivedSharedRooms\/\{shareId\}\s*\{[\s\S]*?allow read, write: if false;/, 'received shared room indexes'],
  [/match \/users\/\{userId\}\/sharedRooms\/\{shareId\}\s*\{[\s\S]*?allow read, write: if false;/, 'owner shared room mirrors']
]) assert.match(rules, pattern, `${label} must be explicitly denied for the MVP.`);

for (const path of ['profiles/alice', 'posts/post-1', 'friendRequests/alice_bob',
  'users/alice/blocks/bob', 'sharedRooms/share-1', 'sharedShopping/alice_bob']) {
  assert.ok(path.length > 0);
}
assert.match(rules, /match \/users\/\{userId\}\/aiUsage\/\{dayKey\}\s*\{\s*allow\s+read,\s*write:\s*if\s+false;/);
assert.match(rules, /match \/users\/\{userId\}\/timelineUsage\/\{dayKey\}\s*\{\s*allow\s+read,\s*write:\s*if\s+false;/);
assert.doesNotMatch(rules, /match\s+\/\{document=\*\*\}/);
assert.match(rules, /}\s*}\s*$/);
console.log('Firestore MVP gate passed: room and personal shopping sync remain owner-only; all SNS and friend-sharing paths are denied.');
