import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync('index.html', 'utf8');
const rules = readFileSync('firestore.rules', 'utf8');
const tests = readFileSync('tests/firestore.rules.test.mjs', 'utf8');
assert.match(html, /id="sns"[^>]*hidden[^>]*aria-hidden="true"/,
  'SNS UI must remain hidden in the MVP.');
const start = rules.indexOf('match /friendRequests/{requestId}');
assert.ok(start >= 0, 'Friend request path must be explicitly declared.');
const block = rules.slice(start, rules.indexOf('\n    // Recipient snapshots', start));
assert.match(block, /allow read, write: if false;/,
  'Direct client access to friend requests must be denied.');
assert.match(tests, /SNS and friend-sharing data are disabled for the MVP/);
assert.match(tests, /friendRequests\/alice_bob/);
console.log('MVP friend-request gate passed: SNS UI hidden and Firestore access denied.');
