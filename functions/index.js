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
  res.status(status)
    .set("Content-Type", "application/json; charset=utf-8")
    .set("Cache-Control", "no-store, max-age=0, private")
    .set("Pragma", "no-cache")
    .send(body);
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

    const decoded = await getAuth().verifyIdToken(match[1], true);
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
      const storedCount = snap.exists ? snap.data().count : 0;
      // Treat malformed counters as exhausted rather than accidentally allowing unlimited requests.
      const count = Number.isSafeInteger(storedCount) && storedCount >= 0 ? storedCount : 10;
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
    let keepUsageReservation = false;
    try {
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
        }),
        signal: AbortSignal.timeout(45000)
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

      keepUsageReservation = true;
      return sendJson(res, 200, { reply });
    } finally {
      if (!keepUsageReservation) {
        try {
          await getFirestore().runTransaction(async tx => {
            const latestUsage = await tx.get(usageRef);
            const count = latestUsage.exists ? latestUsage.data().count : 0;
            if (!Number.isSafeInteger(count) || count <= 0) return;
            if (count === 1) {
              tx.delete(usageRef);
            } else {
              tx.update(usageRef, { count: count - 1, updatedAt: Timestamp.now() });
            }
          });
        } catch (refundError) {
          console.error("AI usage reservation refund failed:", refundError?.message || refundError);
        }
      }
    }
  } catch (error) {
    console.error("AI consultation error:", error?.message || error);
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      return sendJson(res, 504, { error: "AIの返答に時間がかかっています。少し時間をおいて再度お試しください。" });
    }
    if (["auth/argument-error", "auth/id-token-expired", "auth/invalid-id-token", "auth/id-token-revoked", "auth/user-disabled"].includes(error?.code)) {
      return sendJson(res, 401, { error: "ログイン状態を確認できません。もう一度ログインしてください。" });
    }
    return sendJson(res, 500, { error: "相談機能でエラーが発生しました。入力内容は画面に残して再試行できます。" });
  }
});


const reportCategories = new Set([
  "harassment",
  "bullying",
  "inappropriate_content",
  "privacy",
  "impersonation",
  "other"
]);

exports.submitReport = onRequest({
  region: "asia-northeast1",
  maxInstances: 3,
  timeoutSeconds: 30,
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

    const decoded = await getAuth().verifyIdToken(match[1], true);
    const targetUid = typeof req.body?.targetUid === "string" ? req.body.targetUid.trim() : "";
    const category = typeof req.body?.category === "string" ? req.body.category : "";
    const reportType = req.body?.reportType === "comment" ? "comment" : "user";
    const targetPostId = typeof req.body?.targetPostId === "string" ? req.body.targetPostId : "";
    const targetCommentId = typeof req.body?.targetCommentId === "string" ? req.body.targetCommentId : "";
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(targetUid) || targetUid === decoded.uid) {
      return sendJson(res, 400, { error: "通報する相手のユーザーIDを確認してください。" });
    }
    if (!reportCategories.has(category)) {
      return sendJson(res, 400, { error: "通報理由を選択してください。" });
    }
    try {
      await getAuth().getUser(targetUid);
    } catch (lookupError) {
      if (lookupError?.code === "auth/user-not-found") {
        return sendJson(res, 400, { error: "通報する相手のユーザーIDを確認してください。" });
      }
      throw lookupError;
    }

    const db = getFirestore();
    if (reportType === "comment") {
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(targetPostId) || !/^[A-Za-z0-9_-]{1,128}$/.test(targetCommentId)) {
        return sendJson(res, 400, { error: "通報対象のコメントを確認できません。" });
      }
      const postRef = db.collection("posts").doc(targetPostId);
      const [postSnap, commentSnap, forwardFriend, reverseFriend] = await Promise.all([
        postRef.get(),
        postRef.collection("comments").doc(targetCommentId).get(),
        db.doc(`friendRequests/${decoded.uid}_${targetUid}`).get(),
        db.doc(`friendRequests/${targetUid}_${decoded.uid}`).get()
      ]);
      const post = postSnap.data();
      const comment = commentSnap.data();
      const isAcceptedFriend = (forwardFriend.exists && forwardFriend.data().status === "accepted")
        || (reverseFriend.exists && reverseFriend.data().status === "accepted");
      if (!postSnap.exists || !["public", "friends"].includes(post?.visibility) || post?.status !== "active"
        || (post?.visibility === "friends" && !isAcceptedFriend)
        || !commentSnap.exists || comment?.status !== "active" || comment?.authorUid !== targetUid) {
        return sendJson(res, 400, { error: "通報対象のコメントは確認できません。投稿が非公開・削除済みか、対象が変更されています。" });
      }
    }
    const now = new Date();
    const tokyoDate = new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(now).reduce((parts, part) => {
      if (part.type !== "literal") parts[part.type] = part.value;
      return parts;
    }, {});
    const dayKey = `${tokyoDate.year}-${tokyoDate.month}-${tokyoDate.day}`;
    const usageRef = db.doc(`users/${decoded.uid}/reportUsage/${dayKey}`);
    const reportRef = db.collection("reports").doc();

    const allowed = await db.runTransaction(async tx => {
      const snap = await tx.get(usageRef);
      const storedCount = snap.exists ? snap.data().count : 0;
      const count = Number.isSafeInteger(storedCount) && storedCount >= 0 ? storedCount : 5;
      if (count >= 5) return false;
      tx.set(usageRef, { count: count + 1, updatedAt: Timestamp.now() }, { merge: true });
      tx.create(reportRef, {
        reporterUid: decoded.uid,
        targetUid,
        category,
        reportType,
        ...(reportType === "comment" ? { targetPostId, targetCommentId } : {}),
        status: "pending",
        createdAt: Timestamp.now()
      });
      return true;
    });

    if (!allowed) return sendJson(res, 429, { error: "本日の通報上限に達しました。必要な場合は信頼できる大人にも相談してください。" });
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    console.error("Report submission error:", error?.message || error);
    if (["auth/argument-error", "auth/id-token-expired", "auth/invalid-id-token", "auth/id-token-revoked", "auth/user-disabled"].includes(error?.code)) {
      return sendJson(res, 401, { error: "ログイン状態を確認できません。もう一度ログインしてください。" });
    }
    return sendJson(res, 500, { error: "通報を送信できませんでした。時間をおいて再度お試しください。" });
  }
});



// Return only public, active posts whose authors are visible and not blocked in either direction.
exports.publicTimeline = onRequest({
  region: "asia-northeast1",
  maxInstances: 3,
  timeoutSeconds: 30,
  memory: "256MiB"
}, async (req, res) => {
  const origin = setReportCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return sendJson(res, 405, { error: "POSTで送信してください。" });
  if (origin && !allowedOrigins.has(origin)) return sendJson(res, 403, { error: "この接続元からは利用できません。" });

  try {
    const authHeader = req.get("authorization") || "";
    const match = authHeader.match(/^Bearer (.+)$/);
    if (!match) return sendJson(res, 401, { error: "Googleログインが必要です。" });
    const decoded = await getAuth().verifyIdToken(match[1], true);
    const db = getFirestore();

    const [publicPosts, friendPosts, incomingFriends, outgoingFriends, viewerBlocksSnapshot] = await Promise.all([
      db.collection("posts").where("visibility", "==", "public").where("status", "==", "active").orderBy("createdAt", "desc").limit(50).get(),
      db.collection("posts").where("visibility", "==", "friends").where("status", "==", "active").orderBy("createdAt", "desc").limit(100).get(),
      db.collection("friendRequests").where("toUid", "==", decoded.uid).where("status", "==", "accepted").limit(100).get(),
      db.collection("friendRequests").where("fromUid", "==", decoded.uid).where("status", "==", "accepted").limit(100).get(),
      db.collection("users").doc(decoded.uid).collection("blocks").get()
    ]);
    const friendUids = new Set([
      ...incomingFriends.docs.map(item => item.data().fromUid),
      ...outgoingFriends.docs.map(item => item.data().toUid)
    ].filter(uid => typeof uid === "string" && uid !== decoded.uid));
    const postsSnapshot = {
      docs: [...publicPosts.docs, ...friendPosts.docs.filter(item => friendUids.has(item.data().authorUid))]
        .sort((a, b) => (b.data().createdAt?.toMillis?.() ?? 0) - (a.data().createdAt?.toMillis?.() ?? 0))
        .slice(0, 50)
    };
    const viewerBlocks = new Set(viewerBlocksSnapshot.docs.map(item => item.id));
    const authorUids = [...new Set(postsSnapshot.docs
      .map(item => item.data().authorUid)
      .filter(uid => typeof uid === "string" && uid.length > 0))];
    const authorRefs = authorUids.flatMap(uid => [
      db.doc(`profiles/${uid}`),
      db.doc(`users/${uid}/blocks/${decoded.uid}`)
    ]);
    const authorSnapshots = authorRefs.length ? await db.getAll(...authorRefs) : [];
    const authors = new Map();
    authorUids.forEach((uid, index) => {
      authors.set(uid, {
        profile: authorSnapshots[index * 2],
        blocksViewer: authorSnapshots[index * 2 + 1]
      });
    });

    const items = [];
    for (const snapshot of postsSnapshot.docs) {
      const post = snapshot.data();
      const authorUid = post.authorUid;
      if (typeof post.text !== "string" || !post.text.trim() || post.text.length > 500) continue;
      const author = authors.get(authorUid);
      if (!author) continue;
      const isSelf = authorUid === decoded.uid;
      if (!isSelf && (viewerBlocks.has(authorUid) || author.blocksViewer.exists)) continue;
      const profile = author.profile.exists ? author.profile.data() : null;
      const isFriendsPost = post.visibility === "friends" && friendUids.has(authorUid);
      if (!isSelf && (!profile || (post.visibility === "public" && profile.visibility !== "public") || (post.visibility === "friends" && !isFriendsPost))) continue;
      const avatarId = ["avatar-01", "avatar-02", "avatar-03", "avatar-04", "avatar-05"].includes(profile?.avatarId)
        ? profile.avatarId : "avatar-01";
      items.push({
        id: snapshot.id,
        authorUid,
        nickname: typeof profile?.nickname === "string" && profile.nickname.trim()
          ? profile.nickname.trim().slice(0, 24) : (isSelf ? "あなた" : "ユーザー"),
        avatarId,
        visibility: post.visibility === "friends" ? "friends" : "public",
        text: post.text,
        createdAtMs: post.createdAt?.toMillis?.() ?? null
      });
    }

    return sendJson(res, 200, { items });
  } catch (error) {
    console.error("Public SNS timeline error:", error?.message || error);
    if (["auth/argument-error", "auth/id-token-expired", "auth/invalid-id-token", "auth/id-token-revoked", "auth/user-disabled"].includes(error?.code)) {
      return sendJson(res, 401, { error: "ログイン状態を確認できません。もう一度ログインしてください。" });
    }
    return sendJson(res, 500, { error: "公開投稿を読み込めませんでした。" });
  }
});


// Search only explicitly public profiles by nickname; never return contact information.
exports.searchPublicProfiles = onRequest({
  region: "asia-northeast1",
  maxInstances: 3,
  timeoutSeconds: 30,
  memory: "256MiB"
}, async (req, res) => {
  const origin = setReportCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return sendJson(res, 405, { error: "POSTで送信してください。" });
  if (origin && !allowedOrigins.has(origin)) return sendJson(res, 403, { error: "この接続元からは利用できません。" });

  try {
    const authHeader = req.get("authorization") || "";
    const match = authHeader.match(/^Bearer (.+)$/);
    if (!match) return sendJson(res, 401, { error: "Googleログインが必要です。" });
    const decoded = await getAuth().verifyIdToken(match[1], true);
    const prefix = typeof req.body?.prefix === "string" ? req.body.prefix.trim() : "";
    if (prefix.length < 2 || prefix.length > 24 || /[\u0000-\u001f]/.test(prefix)) {
      return sendJson(res, 400, { error: "ニックネームを2〜24文字で入力してください。" });
    }

    const db = getFirestore();
    const tokyoDate = new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date()).reduce((parts, part) => {
      if (part.type !== "literal") parts[part.type] = part.value;
      return parts;
    }, {});
    const dayKey = `${tokyoDate.year}-${tokyoDate.month}-${tokyoDate.day}`;
    const usageRef = db.doc(`users/${decoded.uid}/profileSearchUsage/${dayKey}`);
    const allowed = await db.runTransaction(async tx => {
      const snap = await tx.get(usageRef);
      const storedCount = snap.exists ? snap.data().count : 0;
      const count = Number.isSafeInteger(storedCount) && storedCount >= 0 ? storedCount : 30;
      if (count >= 30) return false;
      tx.set(usageRef, { count: count + 1, updatedAt: Timestamp.now() }, { merge: true });
      return true;
    });
    if (!allowed) return sendJson(res, 429, { error: "本日のプロフィール検索上限に達しました。" });

    let keepSearchReservation = false;
    try {
      const [matches, viewerBlocks] = await Promise.all([
        db.collection("profiles")
          .where("visibility", "==", "public")
          .orderBy("nickname")
          .startAt(prefix)
          .endAt(prefix + "\uf8ff")
          .limit(10)
          .get(),
        db.collection("users").doc(decoded.uid).collection("blocks").get()
      ]);
      const candidates = matches.docs.filter(item => item.id !== decoded.uid && !viewerBlocks.docs.some(block => block.id === item.id));
      const reverseBlocks = candidates.length
        ? await db.getAll(...candidates.map(item => db.doc(`users/${item.id}/blocks/${decoded.uid}`)))
        : [];
      const items = candidates.filter((item, index) => !reverseBlocks[index].exists).map(item => {
        const data = item.data();
        return {
          uid: item.id,
          nickname: typeof data.nickname === "string" ? data.nickname.trim().slice(0, 24) : "ユーザー",
          avatarId: ["avatar-01", "avatar-02", "avatar-03", "avatar-04", "avatar-05"].includes(data.avatarId)
            ? data.avatarId : "avatar-01"
        };
      });
      keepSearchReservation = true;
      return sendJson(res, 200, { items });
    } finally {
      if (!keepSearchReservation) {
        try {
          await db.runTransaction(async tx => {
            const latestUsage = await tx.get(usageRef);
            const count = latestUsage.exists ? latestUsage.data().count : 0;
            if (!Number.isSafeInteger(count) || count <= 0) return;
            if (count === 1) tx.delete(usageRef);
            else tx.update(usageRef, { count: count - 1, updatedAt: Timestamp.now() });
          });
        } catch (refundError) {
          console.error("Profile search usage reservation refund failed:", refundError?.message || refundError);
        }
      }
    }
  } catch (error) {
    console.error("Public profile search error:", error?.message || error);
    if (["auth/argument-error", "auth/id-token-expired", "auth/invalid-id-token", "auth/id-token-revoked", "auth/user-disabled"].includes(error?.code)) {
      return sendJson(res, 401, { error: "ログイン状態を確認できません。もう一度ログインしてください。" });
    }
    return sendJson(res, 500, { error: "プロフィールを検索できませんでした。" });
  }
});


const reportReviewStatuses = new Set(["reviewed", "actioned", "dismissed"]);

async function verifyAdminRequest(req, res) {
  const authHeader = req.get("authorization") || "";
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) {
    sendJson(res, 401, { error: "ログインが必要です。" });
    return null;
  }
  const decoded = await getAuth().verifyIdToken(match[1], true);
  if (decoded.admin !== true) {
    sendJson(res, 403, { error: "運営担当者のみ利用できます。" });
    return null;
  }
  return decoded;
}

function setReportCors(req, res) {
  const origin = req.get("origin");
  if (origin && allowedOrigins.has(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
  }
  res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  return origin;
}

// Admin access is controlled only by the verified Firebase custom claim.
// No client-facing endpoint can grant or modify this claim.
exports.adminListReports = onRequest({
  region: "asia-northeast1",
  maxInstances: 2,
  timeoutSeconds: 30,
  memory: "256MiB"
}, async (req, res) => {
  const origin = setReportCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return sendJson(res, 405, { error: "POSTで送信してください。" });
  if (origin && !allowedOrigins.has(origin)) return sendJson(res, 403, { error: "この接続元からは利用できません。" });

  try {
    const admin = await verifyAdminRequest(req, res);
    if (!admin) return;
    const status = typeof req.body?.status === "string" ? req.body.status : "pending";
    if (!["pending", ...reportReviewStatuses].includes(status)) {
      return sendJson(res, 400, { error: "確認状態を指定してください。" });
    }

    const snapshot = await getFirestore()
      .collection("reports")
      .where("status", "==", status)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();
    const reports = snapshot.docs.map(item => {
      const data = item.data();
      return {
        id: item.id,
        reporterUid: data.reporterUid,
        targetUid: data.targetUid,
        category: data.category,
        reportType: data.reportType === "comment" ? "comment" : "user",
        ...(data.reportType === "comment" ? { targetPostId: data.targetPostId, targetCommentId: data.targetCommentId } : {}),
        status: data.status,
        createdAtMs: data.createdAt?.toMillis?.() ?? null
      };
    });

    return sendJson(res, 200, { reports });
  } catch (error) {
    console.error("Admin report list error:", error?.message || error);
    if (["auth/argument-error", "auth/id-token-expired", "auth/invalid-id-token", "auth/id-token-revoked", "auth/user-disabled"].includes(error?.code)) {
      return sendJson(res, 401, { error: "ログイン状態を確認できません。もう一度ログインしてください。" });
    }
    return sendJson(res, 500, { error: "通報一覧を読み込めませんでした。" });
  }
});

exports.adminUpdateReport = onRequest({
  region: "asia-northeast1",
  maxInstances: 2,
  timeoutSeconds: 30,
  memory: "256MiB"
}, async (req, res) => {
  const origin = setReportCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return sendJson(res, 405, { error: "POSTで送信してください。" });
  if (origin && !allowedOrigins.has(origin)) return sendJson(res, 403, { error: "この接続元からは利用できません。" });

  try {
    const admin = await verifyAdminRequest(req, res);
    if (!admin) return;
    const reportId = typeof req.body?.reportId === "string" ? req.body.reportId : "";
    const status = typeof req.body?.status === "string" ? req.body.status : "";
    if (!/^[A-Za-z0-9_-]{20}$/.test(reportId) || !reportReviewStatuses.has(status)) {
      return sendJson(res, 400, { error: "通報番号または確認状態を確認してください。" });
    }

    const reportRef = getFirestore().collection("reports").doc(reportId);
    const updated = await getFirestore().runTransaction(async tx => {
      const snapshot = await tx.get(reportRef);
      if (!snapshot.exists || snapshot.data().status !== "pending") return false;
      tx.update(reportRef, {
        status,
        reviewedBy: admin.uid,
        reviewedAt: Timestamp.now()
      });
      return true;
    });
    if (!updated) return sendJson(res, 409, { error: "この通報は存在しないか、すでに確認済みです。再読み込みしてください。" });
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    console.error("Admin report update error:", error?.message || error);
    if (["auth/argument-error", "auth/id-token-expired", "auth/invalid-id-token", "auth/id-token-revoked", "auth/user-disabled"].includes(error?.code)) {
      return sendJson(res, 401, { error: "ログイン状態を確認できません。もう一度ログインしてください。" });
    }
    return sendJson(res, 500, { error: "通報の確認状態を更新できませんでした。" });
  }
});
