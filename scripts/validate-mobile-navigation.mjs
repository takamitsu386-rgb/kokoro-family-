import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
const mvpScope = readFileSync(new URL("../MVP_SCOPE.md", import.meta.url), "utf8");
const aiSetup = readFileSync(new URL("../AI_CONSULTATION_SETUP.md", import.meta.url), "utf8");

assert.match(html, /class="mobile-quick-nav"/, "mobile quick navigation exists");
assert.match(html, /class="first-steps" role="region" aria-labelledby="firstStepsTitle"/, "first-use guide exists and has an accessible region label");
for (const id of ["room-design", "today-plan", "family-tasks", "backupTitle"]) {
  assert.match(html, new RegExp('class="first-steps"[\\s\\S]*?href="#' + id + '"'), "first-use guide links to " + id);
}
assert.match(html, /AI相談とSNS・友だち交流は現在停止中です/, "first-use guide discloses paused features");
for (const id of ["home", "family-weekly-plan", "family-tasks", "family-calendar", "family-shopping"]) {
  assert.match(html, new RegExp('href="#' + id + '"'), "quick navigation links to " + id);
}
assert.match(html, /@media\(max-width:600px\)/, "mobile layout breakpoint exists");
assert.match(html, /env\(safe-area-inset-bottom\)/, "bottom navigation respects device safe area");
assert.match(html, /min-height:52px/, "quick navigation touch targets are sufficiently tall");
assert.match(html, /scroll-snap-type:x proximity/, "top navigation supports touch scrolling");
assert.match(sw, /kokoro-family-v369/, "service worker cache is refreshed");
assert.match(mvpScope, /Service Worker cacheは v369\./, "MVP documentation cache version is current");
assert.match(aiSetup, /Service Workerは v369\./, "AI setup documentation cache version is current");

console.log("Mobile navigation source checks passed.");
