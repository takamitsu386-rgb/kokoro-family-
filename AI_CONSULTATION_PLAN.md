# こころファミリー：AI相談機能の統合計画

## 現在の実装状況

この作業ブランチ `feature/ai-consultation-integration` には、AI相談機能の画面とサーバー側処理を実装済みです。

- `index.html`: 既存アプリ内のAI相談画面、送信中・エラー表示、入力制限、会話表示を実装。
- `functions/index.js`: Firebase AuthenticationのIDトークン検証、利用回数制限、OpenAI Responses APIへのサーバー側リクエストを実装。
- `functions/package.json`: Cloud Functionsの依存関係とNode.js 22を設定。
- `firebase.json`: FunctionsのNode.js 22設定と、`/api/ai-consultation` の関数への転送を設定。
- AI相談の会話内容はアプリ側で永続保存せず、ページ内メモリで扱う設計。ページ再読み込み・終了で会話が消えることを画面に明記し、送信中は支援技術にも処理中と伝える。
- Service Workerのキャッシュバージョンは v107。
- `.github/workflows/source-validation.yml`: Node.js 22でCloud FunctionsのJavaScript構文とFirebase・FunctionsのJSON設定を自動確認するGitHub Actionsを追加。ワークフローの実行結果はGitHub Actions上で別途確認する。

## サーバー側の保護

- Firebase IDトークンを検証し、失効済み・無効化済みアカウントのトークンも拒否する。
- 相談文の長さを1〜1200文字に制限する。
- 会話履歴として扱うメッセージ数を直近6件に制限する。
- AI応答の送受信中に認証状態が一度でも切り替わった場合、同じUIDへ戻っても古い応答や入力内容を引き継がないよう、認証切替世代を検証する。
- スマホでポップアップログインが使えない場合はリダイレクト方式へ切り替え、ログイン完了後にAI相談セクションへ戻す。承認済みドメインエラーにはFirebase側の設定確認を案内する。
- 利用回数はユーザーごとに日本時間の日付単位で管理し、1日10回を上限とする。カウンター値が不正な場合は安全側に倒して利用を拒否する。
- 利用回数記録はCloud FunctionsのAdmin SDKで扱い、クライアント向けFirestoreルールでは許可しない。
- OpenAI APIキーはコードに含めず、Firebase Secret Managerの `OPENAI_API_KEY` から取得する構成。
- OpenAI Responses APIでは `store:false` を指定する。
- AI事業者への通信は45秒でタイムアウトし、時間切れは504として画面に再試行可能な案内を返す。
- 許可するHostingオリジンをサーバー側で確認する。
- 未成年者に配慮した応答方針をサーバー側に設定し、診断や危険な手順の案内を避ける。

## 公開前に必要な管理者作業

1. FirebaseプロジェクトIDが `kokoro-family` であることを確認する。
2. AuthenticationでGoogleログインを有効にする。
3. 実際に使用するHostingドメインをAuthenticationの承認済みドメインに登録する。
4. Cloud Functionsの利用条件、請求設定、必要な権限を確認する。
5. OpenAI APIの利用条件と料金を確認する。
6. Firebase Secret Managerへ `OPENAI_API_KEY` を安全に登録する。
7. 現在のFirestoreルールを確認し、リポジトリ内のルールと比較する。既存ルールを確認せずに上書きしない。
8. 管理者が内容を確認したうえでFunctionsとHostingをデプロイする。

## 未完了の検証

次の項目はまだ実施済みと確認できていません。

- Firebase Console側の設定とSecret登録
- Cloud FunctionsおよびHostingのデプロイ
- Googleログインを含む実ブラウザ・スマートフォンでの動作確認
- 未ログイン拒否、アカウント切替、日次上限、AI応答、通信エラー時の再試行の実機テスト
- 公開版への反映判断

ソースコードが作業ブランチに存在することと、Firebase上で機能が稼働していることは別です。この文書は実装済みソースと未完了作業を区別して記録します。

## 公開・変更の方針

- 作業は `feature/ai-consultation-integration` ブランチで継続する。
- 公開ブランチやバックアップブランチへの反映、Firebaseへのデプロイは、管理者の確認なしに行わない。
- APIキーや管理者秘密情報をチャット、GitHubのソースコード、フロントエンドへ貼り付けない。
