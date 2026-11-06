import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const rules = readFileSync('firestore.rules', 'utf8');

assert.match(rules, /^rules_version\s*=\s*'2';/m, 'Firestore Rules v2 must be enabled.');
assert.match(rules, /match\s+\/databases\/\{database\}\/documents\s*\{/,
  'Firestore database document scope is missing.');
assert.match(rules, /match\s+\/users\/\{userId\}\/kokoro\/\{documentId\}\s*\{/,
  'Existing private room-data path must remain explicitly scoped.');
assert.match(rules, /request\.auth\s*!=\s*null/,
  'Room data must require an authenticated user.');
assert.match(rules, /request\.auth\.uid\s*==\s*userId/,
  'Room data must be restricted to its owning UID.');
assert.match(rules, /documentId\s*==\s*"data"/,
  'Room data access must remain limited to the data document.');

const allowStatements = rules.match(/\ballow\s+[^;]+;/g) ?? [];
assert.equal(allowStatements.length, 1,
  'Unexpected additional Firestore allow rule: review before adding SNS access.');
assert.match(allowStatements[0], /allow\s+read,\s*write\s*:/,
  'The existing room-data permission must remain read/write.');
assert.doesNotMatch(rules, /match\s+\/\{document=\*\*\}/,
  'A recursive catch-all match could unintentionally expose new collections.');

console.log('Firestore access regression checks passed: only the signed-in owner can access their existing room data; new SNS paths remain denied by default.');
