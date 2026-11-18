import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const spec = readFileSync(new URL("../ACCOUNT_DELETION_SPEC.md", import.meta.url), "utf8");

const requiredSections = [
  "## 目的と安全原則",
  "## 必須の削除フロー",
  "## 状態・再試行",
  "## 実装前に責任者が決めること",
  "## 必須テスト",
  "## 現在の判定"
];
for (const heading of requiredSections) {
  assert.ok(spec.includes(heading), "Deletion specification is missing section: " + heading);
}

const requiredSafetyStatements = [
  "他の利用者が作成した記録を、所有者の削除だけで誤って破壊しない",
  "通報・不正利用調査など保持理由がある記録は",
  "クライアントからFirestoreを直接一括削除させない",
  "同じ削除要求を安全に再実行できる",
  "Authユーザー削除は最後に行う",
  "本人のアクセス権・参加関係を解除し、他者所有データは維持する",
  "Storage・Analytics・ログ・バックアップ等、現行コード外の保存先",
  "対象保存先の存在・所有権・削除API・保持要件が確定するまでは、削除完了と表示しない",
  "本番アカウントを使った削除試験は行わない"
];
for (const statement of requiredSafetyStatements) {
  assert.ok(spec.includes(statement), "Deletion specification is missing safety requirement: " + statement);
}

const firestoreDeletion = spec.indexOf("**個人データの削除**");
const authDeletion = spec.indexOf("**Auth削除**");
const completionCheck = spec.indexOf("**完了確認**");
assert.ok(firestoreDeletion >= 0 && authDeletion > firestoreDeletion && completionCheck > authDeletion,
  "Deletion order must be Firestore data, then Auth account, then completion verification.");

const stateLine = spec.split("\n").find(line => line.includes("状態例：")) ?? "";
const orderedStates = ["requested", "writes_blocked", "deleting", "auth_deleting", "completed"];
let previousIndex = -1;
for (const state of orderedStates) {
  const index = stateLine.indexOf("`" + state + "`");
  assert.ok(index > previousIndex, "Deletion states are missing or out of order: " + state);
  previousIndex = index;
}
assert.ok(stateLine.includes("`retry_required`"), "Deletion state must include retry_required.");

const ownershipSection = spec.slice(spec.indexOf("## データ所有関係ごとの処理基準"), spec.indexOf("## 必須の削除フロー"));
const requiredOwnershipRules = [
  "本人だけが所有する個人データ",
  "共有買い物（2人共通スナップショット）",
  "共有ルーム（共有スナップショット）",
  "他者が所有し本人が投稿・反応した記録",
  "通報・安全対応・監査記録",
  "Storage・ログ・Analytics・バックアップ等",
  "完了済みステップを再実行しても他者データに副作用を起こさない",
  "一部の削除に失敗した場合、全体を `completed` にしない",
  "Auth削除の結果が不明な場合はAuthの存在状態を再照会し"
];
for (const rule of requiredOwnershipRules) {
  assert.ok(ownershipSection.includes(rule), "Deletion ownership/retry rule is missing: " + rule);
}
const requiredTestCases = [
  "同一要求の二重実行",
  "途中タイムアウト",
  "Functions再起動後の再開",
  "他利用者の所有データを残す",
  "Auth削除失敗時の再試行",
  "全Firestoreコレクション・サブコレクション・Storage・補助記録の残存確認"
];
const testSection = spec.slice(spec.indexOf("## 必須テスト"), spec.indexOf("## 現在の判定"));
for (const testCase of requiredTestCases) {
  assert.ok(testSection.includes(testCase), "Deletion test plan is missing: " + testCase);
}

assert.match(spec, /削除UI\/API\/Cloud Function、削除ジョブ、実行テストは未実装/);
console.log("Account-deletion safety design: required safeguards, deletion order, retry states, and test plan checked.");

// Until the owner has resolved the operational decisions below, CI must prevent
// an incomplete account-deletion endpoint from becoming publicly reachable.
const functionsSource = readFileSync(new URL("../functions/index.js", import.meta.url), "utf8");
const firebaseConfig = JSON.parse(readFileSync(new URL("../firebase.json", import.meta.url), "utf8"));
const hostingRewrites = firebaseConfig.hosting?.rewrites ?? [];
const exportedFunctions = [...functionsSource.matchAll(/exports\\.([A-Za-z0-9_$]+)\\s*=/g)].map(match => match[1]);
assert.ok(!exportedFunctions.some(name => /(?:account.*delet|delet.*account|user.*delet|delet.*user)/i.test(name)),
  "Account/user-deletion endpoints must remain absent until the full reviewed workflow is implemented.");
assert.ok(!hostingRewrites.some(rewrite => /(?:account.*delet|delet.*account|user.*delet|delet.*user)/i.test(String(rewrite.source ?? "") + " " + String(rewrite.function?.functionId ?? ""))),
  "No account-deletion Hosting route may be exposed before the implementation gate is cleared.");
