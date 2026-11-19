import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync('index.html', 'utf8');
const rules = readFileSync('firestore.rules', 'utf8');
const tests = readFileSync('tests/firestore.rules.test.mjs', 'utf8');
assert.match(html, /id="sns"[^>]*hidden[^>]*aria-hidden="true"/);
for (const path of [
  'match /sharedRooms/{shareId}',
  'match /users/{userId}/sharedRooms/{shareId}',
  'match /users/{userId}/receivedSharedRooms/{shareId}',
  'match /users/{userId}/hiddenSharedRooms/{shareId}'
]) {
  const start = rules.indexOf(path);
  assert.ok(start >= 0, `Missing explicit rule path: ${path}`);
  const next = rules.indexOf('\n    match /', start + path.length);
  const block = rules.slice(start, next < 0 ? rules.length : next);
  assert.match(block, /allow read, write: if false;/, `MVP must deny ${path}`);
}
assert.match(tests, /SNS and friend-sharing data are disabled for the MVP/);
assert.match(tests, /sharedRooms\/share-1/);
console.log('MVP shared-room gate passed: SNS hidden and all direct sharing paths denied.');
