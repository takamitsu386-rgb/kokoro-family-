import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync('index.html', 'utf8');
const assignments = [...html.matchAll(/\b[A-Za-z_$][\w$]*\.innerHTML\s*=/g)];
assert.equal(assignments.length, 2,
  'Unexpected innerHTML sink added. Review it and prefer textContent/createElement.');

assert.match(html, /item\.innerHTML\s*=\s*'<span class="item-icon"><\/span><span class="drag-handle" aria-label="つかんで移動">✋<\/span>';/,
  'The room-item innerHTML must remain a fixed, developer-authored template.');
assert.match(html, /select\.innerHTML\s*=\s*'<option value="">保存したお部屋を選ぶ<\/option>';/,
  'The saved-room select innerHTML must remain a fixed, developer-authored option.');
assert.doesNotMatch(html, /insertAdjacentHTML\s*\(|outerHTML\s*=|document\.write\s*\(|\beval\s*\(/,
  'Avoid additional HTML parsing or dynamic code-execution sinks.');

console.log('DOM injection sink review passed: only two fixed, developer-authored innerHTML templates remain.');
