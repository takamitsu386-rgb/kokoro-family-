import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
assert.match(html, /家具の内訳・配置ヒントを見る/, 'Furniture report control must be visible.');
assert.match(html, /id="roomFurnitureReport"[^>]*aria-live="polite"/, 'Report panel must announce updates.');
const start = html.indexOf('function analyzeRoomFurniture(){');
assert.notEqual(start, -1, 'Furniture report handler must exist.');
const end = html.indexOf('\nfunction addFurniture(icon,persist=true){', start);
assert.notEqual(end, -1, 'Furniture report handler must end before addFurniture.');
const handler = html.slice(start, end);
assert.match(handler, /querySelectorAll\('\.furniture'\)/, 'Report must read the current room furniture.');
assert.match(handler, /categoryByIcon/, 'Report must classify furniture.');
assert.match(handler, /iconCounts\.size/, 'Report must count distinct furniture types.');
assert.match(handler, /配置のヒント/, 'Report must provide practical layout hints.');
assert.match(handler, /replaceChildren\(\)/, 'Report must safely rebuild its output.');
assert.match(handler, /textContent/, 'Report output must use safe text rendering.');
assert.match(handler, /レポートを閉じる/, 'Report must provide a close control.');
console.log('Room furniture balance report checks passed.');
