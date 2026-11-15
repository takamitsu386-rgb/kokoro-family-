import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const functions = readFileSync('functions/index.js', 'utf8');
const html = readFileSync('index.html', 'utf8');
const rules = readFileSync('firestore.rules', 'utf8');
const start = functions.indexOf('exports.publicTimeline = onRequest(');
const end = functions.indexOf('const reportReviewStatuses', start);
assert.ok(start >= 0 && end > start, 'Public timeline endpoint must exist.');
const endpoint = functions.slice(start, end);
assert.match(endpoint, /if \(!snsFeatureEnabled\(res\)\) return;/,
  'Timeline API must fail closed unless SNS is explicitly released.');
assert.match(html, /id="sns"[^>]*hidden[^>]*aria-hidden="true"/);
const postStart = rules.indexOf('match /posts/{postId}');
assert.ok(postStart >= 0);
const postRules = rules.slice(postStart, rules.indexOf('\n    // AI consultation quota', postStart));
assert.match(postRules, /allow read, write: if false;/,
  'Posts and nested interactions must be denied at the Firestore layer.');
console.log('MVP timeline gate passed: API fails closed, SNS UI hidden, Firestore post access denied.');
