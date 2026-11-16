import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync('index.html', 'utf8');
const rules = readFileSync('firestore.rules', 'utf8');
const tests = readFileSync('tests/firestore.rules.test.mjs', 'utf8');
assert.match(html, /id="sns"[^>]*hidden[^>]*aria-hidden="true"/,
  'Friend lists must remain outside the MVP UI.');
for (const [path, label] of [
  ['match /friendRequests/{requestId}', 'friend requests'],
  ['match /users/{userId}/blocks/{targetUid}', 'block records']
]) {
  const start = rules.indexOf(path);
  assert.ok(start >= 0, `Missing ${label} rule path.`);
  const next = rules.indexOf('\n    match /', start + path.length);
  const block = rules.slice(start, next < 0 ? rules.length : next);
  assert.match(block, /allow read, write: if false;/, `${label} must be disabled for the MVP.`);
}
assert.match(tests, /SNS and friend-sharing data are disabled for the MVP/);
assert.match(tests, /friendRequests\/alice_bob/);
assert.match(tests, /users\/alice\/blocks\/bob/);
console.log('MVP friends-list gate passed: friend UI hidden and relationship paths denied.');
