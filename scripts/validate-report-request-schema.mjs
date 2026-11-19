import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const source = readFileSync("functions/index.js", "utf8");
const html = readFileSync("index.html", "utf8");
const start = source.indexOf("exports.submitReport = onRequest(");
const end = source.indexOf("\n\n\n// Return only public", start);
assert.ok(start >= 0 && end > start, "Report submission endpoint must exist.");
const endpoint = source.slice(start, end);

assert.match(endpoint, /req\.body\?\.reportType === "comment" \? "comment" : req\.body\?\.reportType === "user" \? "user" : ""/,
  "Report type must accept only the explicit user/comment variants.");
assert.match(endpoint, /if \(!reportType\) \{[\s\S]*?return sendJson\(res, 400/,
  "Missing or invalid report types must be rejected instead of silently becoming user reports.");
assert.match(endpoint, /if \(!\/\^\[A-Za-z0-9_-\]\{1,128\}\$\/\.test\(targetUid\) \|\| targetUid === decoded\.uid\)/,
  "Reports must reject malformed IDs and self-reporting.");
assert.match(endpoint, /if \(!reportCategories\.has\(category\)\)/,
  "Report categories must come from the allowlist.");
assert.match(endpoint, /if \(!\/\^\[A-Za-z0-9_-\]\{1,128\}\$\/\.test\(targetPostId\) \|\| !\/\^\[A-Za-z0-9_-\]\{1,128\}\$\/\.test\(targetCommentId\)\)/,
  "Comment reports must validate both target document IDs.");
assert.match(endpoint, /if \(count >= 5\) return false/,
  "Report submissions must retain the per-account daily quota.");

const client = html.slice(html.indexOf("const response = await fetch(\"/api/submit-report\""));
assert.ok(client.length > 0, "Report client request must exist.");
assert.match(client, /reportType: "comment"/, "Comment reports must send the explicit comment type.");
assert.match(client, /reportType: "user"/, "User reports must send the explicit user type.");

console.log("Report request schema validation passed.");
