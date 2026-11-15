import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const functions = readFileSync('functions/index.js', 'utf8');
const html = readFileSync('index.html', 'utf8');
const rules = readFileSync('firestore.rules', 'utf8');
const start = functions.indexOf('exports.searchPublicProfiles = onRequest(');
const end = functions.indexOf('const reportReviewStatuses', start);
assert.ok(start >= 0 && end > start, 'Profile search endpoint must exist.');
const endpoint = functions.slice(start, end);
assert.match(endpoint, /if \(!snsFeatureEnabled\(res\)\) return;/,
  'Profile search must fail closed unless SNS is explicitly released.');
assert.match(html, /id="sns"[^>]*hidden[^>]*aria-hidden="true"/,
  'Profile search UI must remain hidden in the MVP.');
const profileStart = rules.indexOf('match /profiles/{uid}');
assert.ok(profileStart >= 0);
const profileEnd = rules.indexOf('\n    // Posts', profileStart);
assert.match(rules.slice(profileStart, profileEnd), /allow read, write: if false;/,
  'Direct profile access must be denied in the MVP.');
console.log('MVP profile-search gate passed: API fails closed, UI hidden, direct profile access denied.');
