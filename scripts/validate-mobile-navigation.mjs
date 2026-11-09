import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");

assert.match(html, /class="mobile-quick-nav"/, "mobile quick navigation exists");
for (const id of ["home", "family-weekly-plan", "family-tasks", "family-calendar", "family-shopping"]) {
  assert.match(html, new RegExp('href="#' + id + '"'), "quick navigation links to " + id);
}
assert.match(html, /@media\(max-width:600px\)/, "mobile layout breakpoint exists");
assert.match(html, /env\(safe-area-inset-bottom\)/, "bottom navigation respects device safe area");
assert.match(html, /min-height:52px/, "quick navigation touch targets are sufficiently tall");
assert.match(html, /scroll-snap-type:x proximity/, "top navigation supports touch scrolling");
assert.match(sw, /kokoro-family-v244/, "service worker cache is refreshed");

console.log("Mobile navigation source checks passed.");
