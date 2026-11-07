# AI相談機能の設定・公開手順

## このブランチに追加したもの

- `index.html`: AI相談画面。スマホ幅で折り返し、会話は画面上のメモリだけに保持。
- `functions/index.js`: Firebase AuthenticationのIDトークン確認、1日10回の利用制限、OpenAI Responses APIへのサーバー側リクエスト。
- `functions/package.json`: Cloud Functions依存関係。Node.js 22を使用。
- `firebase.json`: Node.js 22のFunctions設定と、`/api/ai-consultation` を asia-northeast1 の関数へ転送する設定。
- `.firebaserc`: Firebase CLIの既定プロジェクトを `kokoro-family` に固定。

## 公開前に必要なこと

1. FirebaseプロジェクトIDが `kokoro-family` であることを確認する。別プロジェクトへ誤公開しない。
2. Firebase AuthenticationでGoogleログインプロバイダが有効であることを確認する。
3. Authenticationの承認済みドメインに、実際に使うHostingドメイン（`kokoro-family.web.app` または `kokoro-family.firebaseapp.com`）が登録されていることを確認する。実際に公開しているホスト名と完全一致させる。
4. FirebaseプロジェクトでCloud Functionsを利用できる請求・権限設定を確認する。利用料金が発生する可能性があるため、プロジェクト管理者が確認する。
5. OpenAI APIの利用条件・料金を管理者が確認する。
6. APIキーをコードへ書かず、Firebase Secret Managerへ `OPENAI_API_KEY` として登録する。
7. Cloud FunctionsのランタイムはNode.js 22に設定済み。Firebase CLIがNode.js 22のランタイムに対応していることを確認する。
8. Firebase CLIでFunctionsとHostingをデプロイする。
9. Googleログイン、未ログイン拒否、日次上限、AI応答、エラー時の再試行、スマホ表示をテストする。
10. 問題がなければ公開版への反映を別途判断する。

## Googleログインで「auth/api-key-not-valid」が出る場合

このエラーは、Googleログイン画面の見た目やパスワードではなく、Firebase Authenticationへ渡すWeb APIキーが有効でない・対象プロジェクトと一致しない・キーの利用制限に阻まれている場合に確認します。

1. Firebase Consoleで対象プロジェクトが `kokoro-family` であることを確認する。
2. プロジェクト設定の「マイアプリ」からWebアプリのFirebase設定を開き、Web APIキーが現在の開発ブランチの `index.html` に設定された値と一致するか確認する。キーそのものをチャット、スクリーンショット、公開Issueへ貼らない。
3. Google Cloud Consoleの「APIとサービス」→「認証情報」で、そのキーが削除・無効化されていないか確認する。
4. APIキーにアプリケーション制限やAPI制限を設定している場合、実際に利用するHostingドメインとFirebase Authenticationに必要なAPIへのアクセスを妨げていないか、プロジェクト管理者が確認する。制限を変更する場合は、影響範囲を確認してから最小限の変更にする。
5. Google Cloud ConsoleでIdentity Toolkit APIが対象プロジェクトに対して有効か確認する。
6. Firebase AuthenticationのGoogleプロバイダが有効で、承認済みドメインが実際のアクセス先と一致していることを再確認する。
7. 設定変更後、開発版の画面を再読み込みしてログインを再テストする。キーや認証情報をチャットへ送る必要はない。

このリポジトリの静的検証だけでは、Firebase Console上のAPIキー状態、API有効化、HTTPリファラー制限、Googleプロバイダ設定は読み取れません。現時点ではこのエラーが解消したとは扱いません。

## 管理者が実行するコマンド例

```sh
firebase use kokoro-family
firebase functions:secrets:set OPENAI_API_KEY
firebase deploy --only functions,hosting
```

Secretの入力はFirebase CLIの対話画面で行い、チャット・GitHub・ソースコードへ貼り付けない。

## Firestoreルールについて

`firestore.rules` はリポジトリにありますが、現在の `firebase.json` ではFirestoreルールをデプロイ対象として指定していません。既存のFirebase Console上のルールとファイルの内容が一致するか管理者が確認するまで、Firestoreルールを含むデプロイは行わないでください。

## 未完了の確認事項

- この機能はまだデプロイされておらず、実際のAI応答テストも未実施。
- Firebase Functionsの課金設定、Googleログインプロバイダ・承認済みドメイン確認、Secret登録は管理者による作業が必要。
- Service Workerは v108。画面遷移時はネットワークから最新画面を取得し、通信できない場合はキャッシュを使う。これにより、古いログイン画面がキャッシュ優先で残る問題を避ける。
- 既存の公開版・開発版・バックアップ版はこのブランチから自動変更されない。
