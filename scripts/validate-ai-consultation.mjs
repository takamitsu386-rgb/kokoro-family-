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
assert.match(endpoint, /decoded\.aiConsultationAllowed !== true/, 'AI consultation must require a trusted administrator approval claim.');
assert.match(endpoint, /\["13-17",\s*"18\+"\]\.includes\(ageBand\)/, 'AI consultation must reject unverified and under-13 age bands.');
assert.match(endpoint, /consentVersion !== "2026-11-v1"/, 'AI consultation must require the current consent version.');
assert.match(endpoint, /req\.method !== "POST"/, 'AI endpoint must reject non-POST requests.');
assert.match(source, /Cache-Control\", \"no-store, max-age=0, private\"/, 'JSON API responses must not be cached because they may contain private user data.');
assert.match(source, /Pragma\", \"no-cache\"/, 'JSON API responses must include a legacy no-cache directive.');
assert.match(endpoint, /allowedOrigins\.has\(origin\)/, 'AI endpoint must enforce the origin allowlist.');
assert.match(endpoint, /process\.env\.AI_CONSULTATION_ENABLED !== "true"[\s\S]*?return sendJson\(res, 503/, 'AI consultation must fail closed until age safeguards and consent flows are ready.');
assert.match(source, /"https:\/\/takamitsu386-rgb\.github\.io"/, 'AI endpoint must allow the development GitHub Pages origin.');
assert.match(endpoint, /message\.length > 1200/, 'User messages must have a strict size limit.');
assert.match(endpoint, /history\.slice\(-6\)/, 'Conversation history must be limited to the latest six entries.');
assert.match(endpoint, /\["user",\s*"assistant"\]\.includes\(item\.role\)/, 'History must reject unsupported roles.');
assert.match(endpoint, /item\.content\.slice\(0,\s*1200\)/, 'Each history entry must be bounded.');
assert.match(endpoint, /timeZone:\s*"Asia\/Tokyo"/, 'Daily quota must use the Tokyo calendar day.');
assert.match(endpoint, /users\/\$\{decoded\.uid\}\/aiUsage\/\$\{dayKey\}/, 'Quota must be isolated by authenticated user and day.');
assert.match(endpoint, /Number\.isSafeInteger\(storedCount\)[\s\S]*?\? storedCount : 10/, 'Malformed quota counters must fail closed.');
assert.match(endpoint, /if \(count >= 10\) return false/, 'Daily AI usage must be capped.');
assert.match(endpoint, /runTransaction\(async tx =>/, 'Quota updates must be transactional.');
assert.match(endpoint, /usageRef\.collection\("reservations"\)\.doc\(\)/, 'Each concurrent AI request must have its own quota reservation.');
assert.match(endpoint, /tx\.create\(reservationRef/, 'Quota reservation must be created atomically with the counter.');
assert.match(endpoint, /if \(!reservation\.exists\) return/, 'A failed request must refund only its own reservation.');
assert.match(endpoint, /const reservation = await tx\.get\(reservationRef\);[\s\S]*?if \(reservation\.exists\) tx\.delete\(reservationRef\);[\s\S]*?keepUsageReservation = true/, 'Successful requests must remove their temporary reservation without refunding the quota count.');
assert.match(endpoint, /model:\s*"gpt-4\.1-mini"/, 'The configured AI model must be explicit.');
assert.match(endpoint, /store:\s*false/, 'Provider-side response storage must be disabled.');
assert.match(endpoint, /max_output_tokens:\s*500/, 'AI output must be bounded.');
assert.match(endpoint, /AbortSignal\.timeout\(45000\)/, 'Upstream requests must have a timeout.');
assert.match(endpoint, /個人情報を尋ねないでください/, 'The system instructions must discourage collecting personal information.');
assert.match(endpoint, /差し迫った危険があると読み取れる場合は、チャットだけで解決しようとせず/, "Urgent danger must be escalated beyond the chatbot.");
assert.match(endpoint, /学校の先生・スクールカウンセラーなど別の信頼できる大人/, "Potential abuse at home must be routed toward a safer trusted adult.");
assert.match(endpoint, /診断や専門家の代替を名乗らないでください/, 'The system instructions must avoid presenting the model as a clinician.');
assert.match(endpoint, /自傷・自殺、暴力、虐待、危険な行為について具体的な方法や詳細を示さず/, 'Safety instructions must avoid dangerous procedural details.');
assert.match(endpoint, /if \(!reply\) return sendJson\(res, 502/, 'Empty provider responses must not be returned as success.');
assert.match(endpoint, /auth\/id-token-revoked/, 'Revoked tokens must be handled as authentication failures.');

const rewrite = config.hosting?.rewrites?.find(item => item.source === '/api/ai-consultation');
assert.equal(rewrite?.function?.functionId, 'aiConsultation', 'AI Hosting rewrite must target the expected function.');
assert.equal(rewrite?.function?.region, 'asia-northeast1', 'AI Hosting rewrite must use the expected region.');
assert.match(html, /相談内容は返答のため外部AIサービスへ送信されます/, 'The AI screen must disclose external processing before users submit a message.');
assert.match(html, /個人が特定される情報は入力しないでください/, 'The AI screen must warn users not to submit identifying information.');
assert.match(html, /AIの返答は専門家による診断や助言の代わりではありません/, 'The AI screen must explain that it is not a professional substitute.');
assert.match(html, /const aiEndpoint = location\.hostname === "takamitsu386-rgb\.github\.io"/, 'The GitHub Pages client must use the deployed Cloud Functions endpoint.');
assert.match(html, /fetch\(aiEndpoint/, 'The client must use the selected AI endpoint.');
assert.doesNotMatch(html, /\bsk-[A-Za-z0-9_-]{20,}\b/, 'A possible OpenAI secret must never be embedded in client HTML.');

// The browser chat must remain ephemeral and safe to render.
const aiClientStart = html.indexOf('const aiLog = document.getElementById("aiChatLog")');
const aiClientEnd = html.indexOf('</script>', aiClientStart);
assert.ok(aiClientStart >= 0 && aiClientEnd > aiClientStart, 'AI chat client module must exist.');
const aiClient = html.slice(aiClientStart, aiClientEnd);
assert.match(aiClient, /p\.textContent = text/, 'AI messages must be rendered as text, not interpreted as HTML.');
assert.doesNotMatch(aiClient, /\.innerHTML\s*=|insertAdjacentHTML\s*\(/, 'AI messages must not be inserted as executable HTML.');
assert.match(aiClient, /const aiHistory = \[\]/, 'Conversation history must be held only in page memory.');
assert.match(html, /id="aiStatus" data-release-gate="disabled"/, "AI consultation must be visibly marked unavailable until age safeguards are ready.");
assert.match(html, /const aiReleaseDisabled = aiStatus\?\.dataset\.releaseGate === "disabled"/, "The client must derive its disabled state from the release gate.");
assert.match(html, /if \(aiReleaseDisabled\) \{[\s\S]*?aiInput\.disabled = true;[\s\S]*?aiSend\.disabled = true;/, "The AI composer and send button must be disabled while the release gate is closed.");
assert.match(html, /if \(aiReleaseDisabled\) \{\s*aiStatus\.textContent = "AI相談は年齢・同意などの安全設定が整うまで一時停止中です。";/, "The UI must not claim the AI is ready while the release gate is closed.");
assert.match(aiClient, /aiStatus\?\.dataset\.releaseGate === "disabled"/, "The client must stop AI submission while the release gate is closed.");
assert.doesNotMatch(aiClient, /localStorage|sessionStorage|indexedDB/, 'AI conversation content must not be persisted by the client.');
assert.match(aiClient, /aiAuthGeneration\s*\+=\s*1/, 'Account changes must invalidate outstanding AI requests.');
assert.match(aiClient, /let aiRequestController = null/, 'The AI client must track the active network request.');
assert.match(aiClient, /aiRequestController\?\.abort\(\)/, 'Account changes must abort an in-flight AI network request.');
assert.match(aiClient, /const requestController = new AbortController\(\)/, 'Each AI request must have its own cancellation controller.');
assert.match(aiClient, /signal: requestController\.signal/, 'The AI fetch must receive the request cancellation signal.');
assert.match(aiClient, /if \(aiRequestController === requestController\) \{[\s\S]*?aiRequestController = null;[\s\S]*?if \(aiAuthGeneration === requestAuthGeneration\)/, 'Finishing an old request must not clear a newer request controller or unlock a newer account composer.');
assert.match(aiClient, /aiHistory\.length = 0[\s\S]*?aiLog\.replaceChildren\(\)/, 'Account changes must clear prior conversation history and display.');
assert.match(aiClient, /if \(aiCurrentUid !== nextUid\)[\s\S]*?aiInput\.value = ""/, 'Account changes must clear any unsent draft from the previous identity.');
assert.match(aiClient, /getAuth\(user\.auth\.app\)\.currentUser\?\.uid !== user\.uid/, 'AI replies must be discarded if the signed-in account changes during a request.');
assert.match(aiClient, /aiInput\.value = message/, 'Failed requests for the same account must preserve the user draft for retry.');

console.log('AI consultation authentication, privacy, quota, safety, and Hosting checks passed.');


// A request from a previous account must not keep the composer locked or overwrite
// the status/input of the newly active account when its async work finally settles.
assert.match(aiClient, /aiRequestController\?\.abort\(\);[\s\S]*?aiRequestController = null;[\s\S]*?aiBusy = false;[\s\S]*?aiSend\.disabled = false/);
const aiFinallyStart = aiClient.lastIndexOf('} finally {');
const aiFinally = aiClient.slice(aiFinallyStart);
assert.match(aiFinally, /if \(aiRequestController === requestController\)[\s\S]*?if \(aiAuthGeneration === requestAuthGeneration\)[\s\S]*?aiBusy = false/);
assert.doesNotMatch(aiFinally, /else \{[\s\S]*?aiStatus\.textContent = "アカウントが切り替わったため/);
