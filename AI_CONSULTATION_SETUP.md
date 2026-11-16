# AI相談機能の設定・公開手順

## このブランチに追加したもの

- `index.html`: AI相談画面。スマホ幅で折り返し、会話は画面上のメモリだけに保持。
- `functions/index.js`: Firebase AuthenticationのIDトークン確認、信頼された管理者が付与した年齢帯・同意カスタムクレームの確認、1日10回の利用制限、OpenAI Responses APIへのサーバー側リクエスト。
- `functions/package.json`: Cloud Functions依存関係。Node.js 22を使用。
- `firebase.json`: Node.js 22のFunctions設定と、`/api/ai-consultation` を asia-northeast1 の関数へ転送する設定。
- `.firebaserc`: Firebase CLIの既定プロジェクトを `kokoro-family` に固定。

## AI相談のデータ取り扱い

- 相談本文と直近最大6件の会話履歴は、認証済みリクエストとしてCloud FunctionsからOpenAI Responses APIへ送信されます。
- APIリクエストでは `store: false` を指定しています。これはResponses APIのアプリケーション状態保存を無効にする設定であり、事業者側の不正利用監視・安全対策等に伴う保持が一切ないことを意味しません。公開前にOpenAI APIの最新データ利用・保持条件を管理者が確認してください。
- アプリのブラウザ画面では会話をメモリ上にだけ保持し、Firestore・localStorage・sessionStorage・IndexedDBへ会話本文を保存しません。画面の再読み込みやアカウント切り替えで画面上の会話は消えます。
- アカウントが切り替わったときは、会話履歴だけでなく送信前の入力文も消去し、前の利用者の下書きを次の利用者へ引き継ぎません。
- AI相談・通報・管理APIのJSON応答には `Cache-Control: no-store` と `Pragma: no-cache` を付け、ブラウザや中継キャッシュへの保存を抑止します。
- Firestoreに保存するのは、利用者UIDと東京日付ごとの相談回数・更新時刻だけです。相談本文は利用回数記録へ含めません。
- 公開前に、利用者へ「相談内容が外部AIサービスへ送信されること」「専門家や緊急窓口の代わりではないこと」を分かりやすく案内し、保護者・運営者が適切な利用条件を確認してください。

## AI相談のサーバー側利用条件

AI相談APIは、次の条件を**すべて**満たさない限り利用を拒否します。

- Cloud Functionsの環境変数 `AI_CONSULTATION_ENABLED=true`
- Firebase IDトークンのカスタムクレーム `aiConsultationAllowed: true`
- `aiAgeBand` が `13-17` または `18+`
- `aiConsultationConsentVersion: "2026-11-v1"`

年齢帯・同意クレームはブラウザから設定してはいけません。Firebase Admin SDKを使える信頼された管理者だけが、対象地域の要件・年齢確認・必要な同意を確認した後に付与します。利用者がプロフィール画面で自己申告した値を、そのまま許可クレームに変換しないでください。確認できないアカウント、13歳未満、クレームがないアカウントは拒否されます。正確な生年月日はこのAPIのクレームに含めません。

このリポジトリには年齢確認・保護者同意を自動で完了する管理者ワークフローはありません。したがって、現状は安全設定を完了した状態ではなく、AI相談は停止したままです。管理者による審査手順と運営責任者が決まるまでは、環境変数を有効にしないでください。

## 公開前に必要なこと

1. FirebaseプロジェクトIDが `kokoro-family` であることを確認する。別プロジェクトへ誤公開しない。
2. Firebase AuthenticationでGoogleログインプロバイダが有効であることを確認する。
3. Authenticationの承認済みドメインに、実際に使う配信先を登録する。Firebase Hostingなら `kokoro-family.web.app` または `kokoro-family.firebaseapp.com`、GitHub Pagesの開発版なら `takamitsu386-rgb.github.io` を追加する。実際に公開しているホスト名と完全一致させる。
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
3. Google Cloud Consoleの「APIとサービス」→「認証情報」で、そのキーが削除・無効化されていないか確認する。HTTPリファラー制限を使う場合は、実際の配信先（GitHub Pagesなら `https://takamitsu386-rgb.github.io/*`）も許可対象に含める。
4. APIキーにアプリケーション制限やAPI制限を設定している場合、実際に利用するHostingドメインとFirebase Authenticationに必要なAPIへのアクセスを妨げていないか、プロジェクト管理者が確認する。制限を変更する場合は、影響範囲を確認してから最小限の変更にする。
5. Google Cloud ConsoleでIdentity Toolkit APIが対象プロジェクトに対して有効か確認する。
6. Firebase AuthenticationのGoogleプロバイダが有効で、承認済みドメインが実際のアクセス先と一致していることを再確認する。
7. 設定変更後、開発版の画面を再読み込みしてログインを再テストする。キーや認証情報をチャットへ送る必要はない。

このリポジトリの静的検証だけでは、Firebase Console上のAPIキー状態、API有効化、HTTPリファラー制限、Googleプロバイダ設定は読み取れません。現時点ではこのエラーが解消したとは扱いません。

## その他のGoogleログインエラー

開発画面では、代表的なFirebase Authenticationエラーに対して次の確認案内を表示します。

- `auth/operation-not-allowed`: Firebase ConsoleのAuthenticationでGoogleプロバイダを有効にする。
- `auth/app-not-authorized`: 対象FirebaseプロジェクトとWebアプリの登録・許可状態を確認する。
- `auth/network-request-failed`: 通信状態やブラウザ・ネットワーク側の通信制限を確認する。
- `auth/too-many-requests`: 試行を繰り返さず、時間をおいて再試行する。
- `auth/web-storage-unsupported`: 通常のブラウザタブで開き、Cookieやサイトデータの利用設定を確認する。

表示されるエラーコードを控えて管理者へ伝えれば十分です。APIキー、IDトークン、パスワードなどの認証情報は共有しないでください。

## 管理者が実行するコマンド例

```sh
firebase use kokoro-family
firebase functions:secrets:set OPENAI_API_KEY
firebase deploy --only functions,hosting
```

Secretの入力はFirebase CLIの対話画面で行い、チャット・GitHub・ソースコードへ貼り付けない。

## Firestoreルールについて

現在の `firebase.json` では `firestore.rules` と `firestore.indexes.json` をデプロイ対象として指定しています。ただし、指定されていることは本番反映済みという意味ではありません。既存のFirebase Console上のルール・インデックスとリポジトリの内容を管理者が比較し、既存データやアクセス権への影響を確認してから、承認された範囲だけを反映してください。Functions・Hostingだけを先に反映する場合は、次のように対象を限定できます。

```sh
firebase use kokoro-family
firebase deploy --only functions,hosting
```

Firestoreルールとインデックスを反映する場合は、別途レビューと承認後に実行します。

```sh
firebase use kokoro-family
firebase deploy --only firestore:rules,firestore:indexes
```

確認前に `firebase deploy` だけを実行して全サービスを一括反映しないでください。

## 未完了の確認事項

- Cloud Functionsのコードとブラウザ画面は実装済みだが、年齢・同意の管理者ワークフローが未整備のため、リリースゲートは閉じたまま。実際のAI応答テストも未実施。
- Firebase Functionsの課金設定、Googleログインプロバイダ・承認済みドメイン確認、Secret登録は管理者による作業が必要。
- Service Workerは v108。画面遷移時はネットワークから最新画面を取得し、通信できない場合はキャッシュを使う。これにより、古いログイン画面がキャッシュ優先で残る問題を避ける。
- 既存の公開版・開発版・バックアップ版はこのブランチから自動変更されない。
