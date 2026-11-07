import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('functions/index.js', 'utf8');
const html = readFileSync('index.html', 'utf8');
const config = JSON.parse(readFileSync('firebase.json', 'utf8'));

const start = source.indexOf('exports.aiConsultation = onRequest(');
const end = source.indexOf('\n\nconst reportCategories', start);
assert.ok(start >= 0 && end > start, 'AI consultation endpoint must exist.');
const endpoint = source.slice(start, end);

assert.match(endpoint, /region:\s*"asia-northeast1"/, 'AI endpoint must use the expected region.');
assert.match(endpoint, /secrets:\s*\[openAiApiKey\]/, 'AI key must be injected as a server secret.');
assert.match(endpoint, /verifyIdToken\(match\[1\],\s*true\)/, 'AI requests must verify Firebase token revocation.');
assert.match(endpoint, /req\.method !== "POST"/, 'AI endpoint must reject non-POST requests.');
assert.match(endpoint, /allowedOrigins\.has\(origin\)/, 'AI endpoint must enforce the origin allowlist.');
assert.match(endpoint, /message\.length > 1200/, 'User messages must have a strict size limit.');
assert.match(endpoint, /history\.slice\(-6\)/, 'Conversation history must be limited to the latest six entries.');
assert.match(endpoint, /\["user",\s*"assistant"\]\.includes\(item\.role\)/, 'History must reject unsupported roles.');
assert.match(endpoint, /item\.content\.slice\(0,\s*1200\)/, 'Each history entry must be bounded.');
assert.match(endpoint, /timeZone:\s*"Asia\/Tokyo"/, 'Daily quota must use the Tokyo calendar day.');
assert.match(endpoint, /users\/\$\{decoded\.uid\}\/aiUsage\/\$\{dayKey\}/, 'Quota must be isolated by authenticated user and day.');
assert.match(endpoint, /Number\.isSafeInteger\(storedCount\)[\s\S]*?\? storedCount : 10/, 'Malformed quota counters must fail closed.');
assert.match(endpoint, /if \(count >= 10\) return false/, 'Daily AI usage must be capped.');
assert.match(endpoint, /runTransaction\(async tx =>/, 'Quota updates must be transactional.');
assert.match(endpoint, /model:\s*"gpt-4\.1-mini"/, 'The configured AI model must be explicit.');
assert.match(endpoint, /store:\s*false/, 'Provider-side response storage must be disabled.');
assert.match(endpoint, /max_output_tokens:\s*500/, 'AI output must be bounded.');
assert.match(endpoint, /AbortSignal\.timeout\(45000\)/, 'Upstream requests must have a timeout.');
assert.match(endpoint, /個人情報を尋ねないでください/, 'The system instructions must discourage collecting personal information.');
assert.match(endpoint, /診断や専門家の代替を名乗らないでください/, 'The system instructions must avoid presenting the model as a clinician.');
assert.match(endpoint, /自傷・自殺、暴力、虐待、危険な行為について具体的な方法や詳細を示さず/, 'Safety instructions must avoid dangerous procedural details.');
assert.match(endpoint, /if \(!reply\) return sendJson\(res, 502/, 'Empty provider responses must not be returned as success.');
assert.match(endpoint, /auth\/id-token-revoked/, 'Revoked tokens must be handled as authentication failures.');

const rewrite = config.hosting?.rewrites?.find(item => item.source === '/api/ai-consultation');
assert.equal(rewrite?.function?.functionId, 'aiConsultation', 'AI Hosting rewrite must target the expected function.');
assert.equal(rewrite?.function?.region, 'asia-northeast1', 'AI Hosting rewrite must use the expected region.');
assert.match(html, /fetch\("\/api\/ai-consultation"/, 'The client must use the same-origin AI endpoint.');
assert.doesNotMatch(html, /\bsk-[A-Za-z0-9_-]{20,}\b/, 'A possible OpenAI secret must never be embedded in client HTML.');

// The browser chat must remain ephemeral and safe to render.
const aiClientStart = html.indexOf('const aiLog = document.getElementById("aiChatLog")');
const aiClientEnd = html.indexOf('</script>', aiClientStart);
assert.ok(aiClientStart >= 0 && aiClientEnd > aiClientStart, 'AI chat client module must exist.');
const aiClient = html.slice(aiClientStart, aiClientEnd);
assert.match(aiClient, /p\.textContent = text/, 'AI messages must be rendered as text, not interpreted as HTML.');
assert.doesNotMatch(aiClient, /\.innerHTML\s*=|insertAdjacentHTML\s*\(/, 'AI messages must not be inserted as executable HTML.');
assert.match(aiClient, /const aiHistory = \[\]/, 'Conversation history must be held only in page memory.');
assert.doesNotMatch(aiClient, /localStorage|sessionStorage|indexedDB/, 'AI conversation content must not be persisted by the client.');
assert.match(aiClient, /aiAuthGeneration\+\+/, 'Account changes must invalidate outstanding AI requests.');
assert.match(aiClient, /aiHistory\.length = 0[\s\S]*?aiLog\.replaceChildren\(\)/, 'Account changes must clear prior conversation history and display.');
assert.match(aiClient, /getAuth\(user\.auth\.app\)\.currentUser\?\.uid !== user\.uid/, 'AI replies must be discarded if the signed-in account changes during a request.');
assert.match(aiClient, /aiInput\.value = message/, 'Failed requests for the same account must preserve the user draft for retry.');

console.log('AI consultation authentication, privacy, quota, safety, and Hosting checks passed.');
