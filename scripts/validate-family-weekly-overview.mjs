import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");

assert.match(html, /id="family-weekly-plan"/, "weekly overview section exists");
assert.match(html, /id="familyWeeklyPlanRefresh"/, "manual refresh control exists");
assert.match(html, /id="familyWeeklyPlanPrint"/, "print control exists");
assert.match(html, /kokoroFamilyTasksV1/, "tasks are included");
assert.match(html, /kokoroFamilyCalendarV1/, "calendar events are included");
assert.match(html, /kokoroFamilyMealsV1/, "meal plans are included");
assert.match(html, /kokoroFamilyShoppingV1/, "shopping list is included");
assert.match(html, /期限を過ぎたやること/, "overdue tasks are shown separately");
assert.match(html, /window\.print\(\)/, "browser print dialog is invoked");
assert.match(html, /@media print/, "print-specific layout exists");
assert.match(html, /function read\(key,validate,limit\)/, "source data is validated before display");
assert.match(sw, /kokoro-family-v243/, "service worker cache is refreshed");

console.log("Family weekly overview source checks passed.");
