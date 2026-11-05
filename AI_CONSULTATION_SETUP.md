# AI相談機能の設定・公開手順

## このブランチに追加したもの

- `index.html`: AI相談画面。スマホ幅で折り返し、会話は画面上のメモリだけに保持。
- `functions/index.js`: Firebase AuthenticationのIDトークン確認、1日10回の利用制限、OpenAI Responses APIへのサーバー側リクエスト。
- `functions/package.json`: Cloud Functions依存関係。
- `firebase.json`: `/api/ai-consultation` を asia-northeast1 の関数へ転送する設定。

## 公開前に必要なこと

1. FirebaseプロジェクトでCloud Functionsを利用できる請求・権限設定を確認する。利用料金が発生する可能性があるため、プロジェクト管理者が確認する。
2. OpenAI APIの利用条件・料金を管理者が確認する。
3. APIキーをコードへ書かず、Firebase Secret Managerへ `OPENAI_API_KEY` として登録する。
4. Firebase CLIでFunctionsとHostingをデプロイする。
5. Googleログイン、未ログイン拒否、日次上限、AI応答、エラー時の再試行、スマホ表示をテストする。
6. 問題がなければ公開版への反映を別途判断する。

## 管理者が実行するコマンド例

```sh
firebase use kokoro-family
firebase functions:secrets:set OPENAI_API_KEY
firebase deploy --only functions,hosting
```

Secretの入力はFirebase CLIの対話画面で行い、チャット・GitHub・ソースコードへ貼り付けない。

## 未完了の確認事項

- この機能はまだデプロイされておらず、実際のAI応答テストも未実施。
- Firebase Functionsの課金設定とSecret登録は管理者による作業が必要。
- デプロイ前にService Workerのキャッシュバージョンを更新する。
- 既存の公開版・開発版・バックアップ版はこのブランチから自動変更されない。
