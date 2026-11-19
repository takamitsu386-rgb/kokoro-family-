import { readFileSync } from "node:fs";

const source = readFileSync("functions/index.js", "utf8");
const expectedFunctions = [
  "aiConsultation",
  "submitReport",
  "publicTimeline",
  "searchPublicProfiles",
  "adminListReports",
  "adminUpdateReport"
];

const declarations = [
  ...source.matchAll(/exports\.(\w+)\s*=\s*onRequest\(\{([\s\S]*?)\}\s*,/g)
].map((match) => ({
  name: match[1],
  options: match[2]
}));

const actualNames = declarations.map(({ name }) => name);
const missing = expectedFunctions.filter((name) => !actualNames.includes(name));
const unexpected = actualNames.filter((name) => !expectedFunctions.includes(name));

if (missing.length || unexpected.length || new Set(actualNames).size !== actualNames.length) {
  throw new Error(
    "Cloud Functions endpoint inventory mismatch. Missing: " +
    (missing.join(", ") || "none") +
    "; unexpected: " +
    (unexpected.join(", ") || "none")
  );
}

for (const { name, options } of declarations) {
  const region = options.match(/\bregion\s*:\s*["']([^"']+)["']/)?.[1];
  const maxInstances = Number(options.match(/\bmaxInstances\s*:\s*(\d+)/)?.[1]);
  const timeoutSeconds = Number(options.match(/\btimeoutSeconds\s*:\s*(\d+)/)?.[1]);
  const memory = options.match(/\bmemory\s*:\s*["']([^"']+)["']/)?.[1];

  if (region !== "asia-northeast1") {
    throw new Error(name + " must remain in asia-northeast1.");
  }
  if (!Number.isInteger(maxInstances) || maxInstances < 1 || maxInstances > 3) {
    throw new Error(name + " must declare maxInstances between 1 and 3.");
  }
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 1 || timeoutSeconds > 60) {
    throw new Error(name + " must declare timeoutSeconds between 1 and 60.");
  }
  if (memory !== "256MiB") {
    throw new Error(name + " must remain at the reviewed 256MiB memory limit.");
  }
}

console.log(
  "Validated " + declarations.length +
  " Cloud Functions endpoints: region, max instances, timeout, and memory limits."
);
