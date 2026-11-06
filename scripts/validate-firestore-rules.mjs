import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const rules = readFileSync('firestore.rules', 'utf8');
const firebaseConfig = JSON.parse(readFileSync('firebase.json', 'utf8'));

assert.equal(firebaseConfig.firestore?.rules, 'firestore.rules',
  'Firebase configuration must point to the reviewed Firestore rules file.');
assert.equal(firebaseConfig.emulators?.firestore?.port, 8080,
  'Firestore rules tests must use the dedicated local emulator port.');

assert.match(rules, /^rules_version\s*=\s*'2';/m, 'Firestore Rules v2 must be enabled.');
assert.match(rules, /match\s+\/databases\/\{database\}\/documents\s*\{/,
  'Firestore database document scope is missing.');
assert.match(rules, /match\s+\/users\/\{userId\}\/kokoro\/\{documentId\}\s*\{/,
  'Existing private room-data path must remain explicitly scoped.');
assert.match(rules, /request\.auth\s*!=\s*null/,
  'Room data must require an authenticated user.');
assert.match(rules, /function\s+owns\(uid\)\s*\{\s*return\s+signedIn\(\)\s*&&\s*request\.auth\.uid\s*==\s*uid;/,
  'Owner helper must require authentication and match the requested UID.');
assert.match(rules, /match\s+\/users\/\{userId\}\/kokoro\/\{documentId\}\s*\{\s*allow\s+read,\s*write:\s*if\s+owns\(userId\)\s*&&\s*documentId\s*==\s*"data";/s,
  'Existing room data must remain read/write for its owner only.');
assert.match(rules, /documentId\s*==\s*"data"/,
  'Room data access must remain limited to the data document.');

assert.match(rules, /match\s+\/profiles\/\{uid\}\s*\{/,
  'Profile access must remain explicitly scoped.');
assert.match(rules, /match\s+\/posts\/\{postId\}\s*\{/,
  'Post access must remain explicitly scoped.');
assert.match(rules, /function\s+validProfile\(/,
  'Profile field allowlist validation is required.');
assert.match(rules, /function\s+validPost\(/,
  'Post field allowlist validation is required.');
assert.match(rules, /allow\s+read,\s*write:\s*if\s+false;/,
  'Unimplemented SNS subcollections must remain denied by default.');
assert.doesNotMatch(rules, /match\s+\/\{document=\*\*\}/,
  'A recursive catch-all match could unintentionally expose new collections.');

console.log('Firestore access regression checks passed: existing room data remains owner-only; profile and post paths are explicitly scoped; unimplemented SNS paths remain denied.');
