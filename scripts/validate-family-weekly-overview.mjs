import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");

assert.match(html, /id="family-weekly-plan"/, "weekly overview section exists");
assert.match(html, /<script>\s*\/\/ 家族の週間まとめ/, "weekly overview logic is executable JavaScript");
assert.match(html, /id="familyWeeklyPlanRefresh"/, "manual refresh control exists");
assert.match(html, /id="familyWeeklyPlanPrint"/, "print control exists");
assert.match(html, /kokoroFamilyTasksV1/, "tasks are included");
assert.match(html, /kokoroFamilyCalendarV1/, "calendar events are included");
assert.match(html, /kokoroFamilyMealsV1/, "meal plans are included");
assert.match(html, /kokoroFamilyShoppingV1/, "shopping list is included");
assert.match(html, /期限を過ぎたやること/, "overdue tasks are shown separately");
assert.match(html, /window\.print\(\)/, "browser print dialog is invoked");
assert.equal((html.match(/dispatchEvent\(new CustomEvent\("kokoro-family-weekly-data-updated"\)\)/g) || []).length, 3, "task, calendar, and meal saves notify the weekly overview");
assert.match(html, /addEventListener\("kokoro-family-weekly-data-updated",render\)/, "weekly overview refreshes immediately after same-tab family data changes");
assert.match(html, /@media print/, "print-specific layout exists");
assert.match(html, /const read=\(key,validate,limit\)=>/, "source data is validated before display");
assert.match(html, /const validISODate=value=>/, "weekly overview uses strict calendar-date validation");
assert.match(html, /validISODate\(x\.dueDate\)/, "weekly overview rejects impossible task due dates");
assert.match(html, /validISODate\(x\.date\)/, "weekly overview rejects impossible event and meal dates");
assert.match(html, /x\.plannedDate===""\|\|validISODate\(x\.plannedDate\)/, "weekly overview rejects impossible shopping dates");
assert.match(sw, /kokoro-family-v370/, "service worker cache is refreshed");

console.log("Family weekly overview source checks passed.");
