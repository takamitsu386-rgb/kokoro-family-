import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const plan = readFileSync(new URL("../ACCOUNT_DELETION_ACCEPTANCE_PLAN.md", import.meta.url), "utf8");
const spec = readFileSync(new URL("../ACCOUNT_DELETION_SPEC.md", import.meta.url), "utf8");
const functions = readFileSync(new URL("../functions/index.js", import.meta.url), "utf8");
const firebaseConfig = JSON.parse(readFileSync(new URL("../firebase.json", import.meta.url), "utf8"));

const requiredHeadings = [
  "# アカウント削除の受け入れ計画（実装前・未承認）",
  "## 1. 実施を開始するための前提条件",
  "## 2. 方針決定記録",
  "## 3. 実装前の保存先確認",
  "## 4. テスト専用環境の準備",
  "## 5. 受け入れテストマトリクス",
  "## 6. 実装・運用の合格条件",
  "## 7. 公開判定"
];
for (const heading of requiredHeadings) {
  assert.ok(plan.includes(heading), "Acceptance plan is missing section: " + heading);
}

const requiredCases = [
  "本人確認失敗", "UID偽装", "書き込み競合", "本人個人データ",
  "共有買い物", "共有ルーム", "友達申請・ブロック", "他者投稿への反応",
  "本人作成投稿", "通報保持例外", "ページング", "部分失敗", "再試行",
  "Auth削除順序", "Auth削除後", "端末内データ", "別端末・外部データ", "保持期限到来"
];
const testSection = plan.slice(
  plan.indexOf("## 5. 受け入れテストマトリクス"),
  plan.indexOf("## 6. 実装・運用の合格条件")
);
for (const testCase of requiredCases) {
  assert.ok(testSection.includes("| " + testCase + " |"),
    "Acceptance test matrix is missing case: " + testCase);
}

const requiredBoundaries = [
  "本番とは別のFirebaseプロジェクト",
  "実在利用者の個人情報をコピーせず",
  "他者所有の親データや独立データを連鎖削除しない",
  "Auth削除は最後に実行",
  "Storage・ログ・Analytics・バックアップ等の保存先確認が未完了",
  "現在の判定：未着手／未承認"
];
for (const boundary of requiredBoundaries) {
  assert.ok(plan.includes(boundary), "Acceptance plan is missing safety boundary: " + boundary);
}

assert.match(spec, /削除UI\/API\/Cloud Function、削除ジョブ、実行テストは未実装/);
const exports = [...functions.matchAll(/exports\.([A-Za-z0-9_$]+)\s*=/g)].map(match => match[1]);
assert.ok(exports.length > 0, "Cloud Functions exports must be detected.");
assert.ok(!exports.some(name => /(?:account.*delet|delet.*account|user.*delet|delet.*user)/i.test(name)),
  "Account/user-deletion endpoint must remain absent until approval and implementation tests.");
const rewrites = firebaseConfig.hosting?.rewrites ?? [];
assert.ok(!rewrites.some(rewrite => /(?:account.*delet|delet.*account|user.*delet|delet.*user)/i.test(
  String(rewrite.source ?? "") + " " + String(rewrite.function?.functionId ?? "")
)), "No account-deletion Hosting route may be exposed before approval.");

console.log("Account-deletion acceptance plan: " + requiredCases.length +
  " test cases, isolation requirements, safety boundaries, and disabled endpoint gate checked.");
