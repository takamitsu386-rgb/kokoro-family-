const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");

initializeApp();

const openAiApiKey = defineSecret("OPENAI_API_KEY");
const allowedOrigins = new Set([
  "https://kokoro-family.web.app",
  "https://kokoro-family.firebaseapp.com",
  "http://localhost:5000",
  "http://127.0.0.1:5000"
]);

function sendJson(res, status, body) {
  res.status(status).set("Content-Type", "application/json; charset=utf-8").send(body);
}

exports.aiConsultation = onRequest({
  region: "asia-northeast1",
  secrets: [openAiApiKey],
  maxInstances: 3,
  timeoutSeconds: 60,
  memory: "256MiB"
}, async (req, res) => {
  const origin = req.get("origin");
  if (origin && allowedOrigins.has(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
  }
  res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return sendJson(res, 405, { error: "POSTで送信してください。" });
  if (origin && !allowedOrigins.has(origin)) return sendJson(res, 403, { error: "この接続元からは利用できません。" });

  try {
    const authHeader = req.get("authorization") || "";
    const match = authHeader.match(/^Bearer (.+)$/);
    if (!match) return sendJson(res, 401, { error: "Googleログインが必要です。" });

    const decoded = await getAuth().verifyIdToken(match[1]);
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!message || message.length > 1200) {
      return sendJson(res, 400, { error: "相談内容は1〜1200文字で入力してください。" });
    }

    const history = Array.isArray(req.body?.history) ? req.body.history.slice(-6) : [];
    const safeHistory = history
      .filter(item => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string")
      .map(item => ({ role: item.role, content: item.content.slice(0, 1200) }));
    const now = new Date();
    const tokyoDate = new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(now).reduce((parts, part) => {
      if (part.type !== "literal") parts[part.type] = part.value;
      return parts;
    }, {});
    const dayKey = `${tokyoDate.year}-${tokyoDate.month}-${tokyoDate.day}`;
    const usageRef = getFirestore().doc(`users/${decoded.uid}/aiUsage/${dayKey}`);

    const allowed = await getFirestore().runTransaction(async tx => {
      const snap = await tx.get(usageRef);
      const count = snap.exists ? Number(snap.data().count || 0) : 0;
      if (count >= 10) return false;
      tx.set(usageRef, {
        count: count + 1,
        updatedAt: Timestamp.now()
      }, { merge: true });
      return true;
    });
    if (!allowed) return sendJson(res, 429, { error: "本日の相談回数の上限に達しました。時間をおいて利用してください。" });

    const input = [
      ...safeHistory,
      { role: "user", content: message }
    ];
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAiApiKey.value()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        instructions: "あなたは未成年者にも適した、穏やかで安全な相談相手です。相手の気持ちを否定せず、決めつけず、短く分かりやすい日本語で返答してください。必要なら一度に一つだけ質問してください。診断や専門家の代替を名乗らないでください。自傷・自殺、暴力、虐待、危険な行為について具体的な方法や詳細を示さず、安全を優先して近くの信頼できる大人や適切な支援につなげてください。個人情報を尋ねないでください。",
        input,
        max_output_tokens: 500,
        store: false
      })
    });

    if (!upstream.ok) {
      console.error("AI provider request failed:", upstream.status);
      return sendJson(res, 502, { error: "AIから返答を受け取れませんでした。少し時間をおいて再度お試しください。" });
    }
    const result = await upstream.json();
    const replyFromOutput = Array.isArray(result.output)
      ? result.output.flatMap(item =>
          item?.type === "message" && Array.isArray(item.content)
            ? item.content.filter(part => part?.type === "output_text" && typeof part.text === "string").map(part => part.text)
            : []
        ).join("\n").trim()
      : "";
    const reply = replyFromOutput || (typeof result.output_text === "string" ? result.output_text.trim() : "");
    if (!reply) return sendJson(res, 502, { error: "返答を受け取れませんでした。もう一度お試しください。" });

    return sendJson(res, 200, { reply });
  } catch (error) {
    console.error("AI consultation error:", error?.message || error);
    if (error?.code === "auth/argument-error" || error?.code === "auth/id-token-expired" || error?.code === "auth/invalid-id-token") {
      return sendJson(res, 401, { error: "ログイン状態を確認できません。もう一度ログインしてください。" });
    }
    return sendJson(res, 500, { error: "相談機能でエラーが発生しました。入力内容は画面に残して再試行できます。" });
  }
});
