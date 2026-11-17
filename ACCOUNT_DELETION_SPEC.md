# アカウント・関連データ削除の設計仕様（未実装）

この文書は実装前の設計基準です。アカウント削除UI、API、Cloud Functionが実装済みであることを意味しません。削除対象・保持例外・失敗復旧を確定し、テストを通すまでは公開ブロッカーとして扱います。

## 目的と安全原則

- 利用者本人の認証情報と本人に紐づく個人データを、再実行可能な手順で削除する。
- 共有データや他の利用者が作成した記録を、所有者の削除だけで誤って破壊しない。
- 通報・不正利用調査など保持理由がある記録は、目的・保持期間・アクセス権限を責任者が定めるまで自動削除しない。
- クライアントからFirestoreを直接一括削除させない。管理権限を持つサーバー処理のみで実行する。
- 部分失敗を検知し、同じ削除要求を安全に再実行できるようにする。Authユーザー削除は最後に行う。

## 現行コードから確認できた保存先

### Firestore

- `users/{uid}/kokoro/{data|shopping}`：本人のお部屋データ・個人用買い物データ。
- `users/{uid}` 配下：同期・利用状態、ブロック、共有ルームの所有者側ミラー／受信者側インデックス／非表示インデックス等。実際のサブコレクションは削除前に再帰的に棚卸しする。
- `sharedShopping`：共有買い物データ。所有者・参加者・共有先の関係を確認し、本人の退出／共有解除と、他の利用者のデータ保持を分ける。
- `profiles`、`posts`、`comments`、`likes`：SNS関連。MVPでは画面・API・Firestore Rulesで停止中だが、既存データが存在しないと仮定してはならない。
- `friendRequests`：本人が送信者または受信者となる申請。
- `sharedRooms`：共有ルームの記録。所有者・受信者の双方のミラーとインデックスも照合する。
- `reports`：通報記録。通報者・対象者のどちらかが削除を要求しても、証拠保全や安全対応上の保持要否を運営責任者が判断する。通常の個人データ削除と同じ一括削除に含めない。
- Functions内で参照する `reservations`、`timelineUsage`、`blocks` 等の利用枠・予約・補助記録も、現行コードとRulesの全パスを再点検して対象UIDを特定する。

### Firestoreの具体的なドキュメント／サブコレクション

- `users/{uid}/kokoro/data`、`users/{uid}/kokoro/shopping`：本人UID配下のプライベートデータ。
- `profiles/{uid}`：公開プロフィール。ドキュメントIDが本人UID。
- `posts/{postId}`：投稿本文。各ドキュメントの `authorUid` が本人か照合する。
- `posts/{postId}/comments/{commentId}`：コメント。投稿者UIDと親投稿の所有者UIDを別々に照合する。
- `posts/{postId}/likes/{likerUid}`：いいね。サブコレクションのドキュメントID（likerUid）が本人か照合する。
- `friendRequests/{requestId}`：`fromUid` または `toUid` が本人の申請。
- `sharedShopping/{shareId}`：`ownerUid`、`recipientUid`、`members` を照合する。本人が片側メンバーの場合、他方の利用者のデータを消去せず、本人の参加・アクセスだけを安全に解除する。
- `sharedRooms/{shareId}`：所有者・受信者のUIDを照合し、本人側ミラー／受信者側インデックスも併せて処理する。
- `reports/{reportId}`：`reporterUid` または `targetUid` が本人の通報。証拠保全・安全対応の保持判断を先に行い、通常削除から分離する。
- `users/{uid}/aiUsage/{dayKey}` と `users/{uid}/aiUsage/{dayKey}/reservations/{reservationId}`、`timelineUsage`、`reportUsage`、`profileSearchUsage`（同配下の `reservations` を含む）：本人UID配下の利用枠と一時予約。
- `users/{uid}/blocks/{targetUid}`、`users/{uid}/following/{targetUid}`、`users/{uid}/hiddenSharedRooms/{shareId}`、`users/{uid}/receivedSharedRooms/{shareId}`、`users/{uid}/sharedRooms/{shareId}`：本人側の関係記録・共有インデックス。相手側の同種ドキュメントを本人所有と誤認しない。

### 端末内データ

現行画面コードには、お部屋・保存したお部屋・履歴・復旧用退避・設定・同期UID等のlocalStorageキーがある。削除画面では、現在の端末からアプリ関連データとバックアップ／復旧用データを消去する範囲を明示する。ブラウザー内の他サイトデータや、利用者が別途保存したエクスポートファイルまでは消去できないことを説明する。別端末のローカルデータは、その端末でログアウト・アプリデータ消去が必要になる場合がある。



### 現行コードで確認した端末内キー（棚卸し基準）

以下は削除実装時に消去対象として照合するキー一覧です。`localStorage` のみを対象とし、ブラウザー全体の保存領域は消去しません。機能追加でキーが増えた場合は、この一覧と検証スクリプトを同時に更新します。

- `kokoroCustomRoomPalettes`
- `kokoroCustomRoomPalettesBeforePaletteImport`
- `kokoroSavedRooms`
- `kokoroSavedRoomsUndo`
- `kokoroSavedRoomPrefs`
- `kokoroRoom`
- `kokoroRoomHistory`
- `kokoroRoomRedo`
- `kokoroRoomRecovery`
- `kokoroSavedRoomsRecovery`
- `kokoroRoomBeforeImport`
- `kokoroSavedRoomsBeforeImport`
- `kokoroSavedRoomPrefsBeforeImport`
- `kokoroCustomRoomPalettesBeforeImport`
- `kokoroRoomBeforeRecovery`
- `kokoroSavedRoomsBeforeRecovery`
- `kokoroSavedRoomPrefsBeforeRecovery`
- `kokoroCustomRoomPalettesBeforeRecovery`
- `kokoroCloudSyncUid`
- `kokoroRoomBeforeCloudImport`
- `kokoroSavedRoomsBeforeCloudImport`
- `kokoroSavedRoomPrefsBeforeCloudImport`
- `kokoroCustomRoomPalettesBeforeCloudImport`
- `kokoroTodayTasksV1`
- `kokoroDailyRoutinesV1`
- `kokoroFamilyCalendarV1`
- `kokoroFamilyMealsV1`
- `kokoroFamilyRecipesV1`
- `kokoroFamilyRecipeFavoritesV1`
- `kokoroFamilyEventPrepV1`
- `kokoroFamilyShoppingV1`
- `kokoroFamilyTasksV1`

この一覧は現時点で検出できたキーの基準であり、動的に組み立てるキーや別モジュールの保存先がないことを保証しません。削除機能の実装前にコード全体の再棚卸しを必須とします。

### UID別の動的キー

- `kokoro-sns-share-cleanup-v1:{uid}`：SNS共有解除後のローカル後処理待ちキュー。現在SNS機能は停止中だが、過去の利用状態が残っている可能性を考慮し、削除時はログイン中UIDに一致するキーを対象にする。プレフィックス一致だけで他アカウントのキューを消去しない。


### セッション内データ

- `kokoroReturnToAiAfterLogin`（`sessionStorage`）：Googleログイン後の画面復帰用。一時データのため、現在のセッション終了時にも残らないことを確認する。


### Cloud Functions・Firestore Rulesで確認した補助データ

- `users/{uid}/aiUsage/{dayKey}` と `users/{uid}/aiUsage/{dayKey}/reservations/{reservationId}`（サブコレクション `reservations`）：AI相談の日次利用枠と処理予約。
- `users/{uid}/timelineUsage/{dayKey}`：タイムラインの日次利用枠。
- `users/{uid}/profileSearchUsage/{dayKey}` と `users/{uid}/profileSearchUsage/{dayKey}/reservations/{reservationId}`：プロフィール検索の日次利用枠と処理予約。
- `users/{uid}/reportUsage/{dayKey}`：通報の日次利用枠。
- `users/{uid}/blocks/{targetUid}`：本人が作成したブロック記録。相手側に作成された本人UID宛てのブロック記録も照合する。
- `posts/{postId}/comments/{commentId}`、`posts/{postId}/likes/{likerUid}`：投稿配下のサブコレクション。投稿者・コメント投稿者・いいねした利用者の関係を個別に判定する。
- `users/{uid}/following/{targetUid}`、`users/{uid}/hiddenSharedRooms/{shareId}`、`users/{uid}/receivedSharedRooms/{shareId}`、`users/{uid}/sharedRooms/{shareId}`：友達・共有ルーム関連の本人側インデックス。

これらは利用枠や関係性の補助データであり、保持例外のある通報本文・他者所有の共有データと同じ扱いにしません。実装時には対象UIDが所有者・参加者・参照先のどの立場かを確認します。

### 外部保存先の確認限界

- 現在のリポジトリでは、firebase.json にFirebase Storageのルール設定はなく、functions/index.js にStorage SDK・バケット操作の参照も検出されていない。
- これはFirebaseプロジェクト側にStorageファイルが存在しない証明ではない。Console上のStorageバケット、Cloud Logging、Analytics、バックアップ、外部サービス、エクスポート済みファイルは、プロジェクト管理者が別途確認する。
- 対象保存先の存在・所有権・削除API・保持要件が確定するまでは、削除完了と表示しない。
## データ所有関係ごとの処理基準

| データ分類 | 削除要求時の扱い | 必ず守る境界 |
| --- | --- | --- |
| 本人だけが所有する個人データ | 対象UIDを照合して削除 | UID一致をサーバー側で確認し、ページング漏れを残存検査する |
| 本人が参加者である共有データ | 本人の参加権・アクセス権・本人側インデックスを解除 | 共有本体や他参加者の記録を本人の削除だけで消さない |
| 本人が所有者で他者が参加する共有データ | 引継ぎまたは共有終了の運用判断後に処理 | 他参加者への影響と通知を確定するまで自動削除しない |
| 他者が所有し本人が投稿・反応した記録 | 本人の個人情報を必要最小限に整理 | 他者所有の親データを連鎖削除しない |
| 通報・安全対応・監査記録 | 保持根拠・期間・閲覧権限に従って別管理 | 通常の一括削除から分離し、保持期限後の処理を別途監査する |
| 端末内の本人データ | 現在の端末でアプリ管理キーを消去 | ブラウザー全体・別端末・外部エクスポートの削除を保証しない |
| Storage・ログ・Analytics・バックアップ等 | 管理者確認後に保存先ごとの手順を決定 | リポジトリ内に参照がないことを、保存データ不存在の根拠にしない |

### 再試行時の不変条件

- 各削除ステップは「未開始・処理中・完了・要再試行」を記録し、完了済みステップを再実行しても他者データに副作用を起こさない。
- バッチのチェックポイントは、対象範囲と最後に確認したカーソルを記録する。再開時は同じ対象範囲を再走査し、途中追加・更新がないか最終残存検査で確認する。
- 一部の削除に失敗した場合、全体を `completed` にしない。失敗段階と安全な再開位置を保持して `retry_required` とする。
- Auth削除の結果が不明な場合はAuthの存在状態を再照会し、削除済みなら完了確認へ、存在するなら管理ジョブでAuth削除を再試行する。
- 保持例外のある記録は削除対象件数から除外し、保持理由・期限・責任者を別台帳で追跡する。保持対象があることだけを理由に、本人の他の個人データ削除を停止しない。

## 必須の削除フロー

1. **再認証と確認**：ログイン中の本人であることを再認証し、削除対象・取り消せないこと・保持例外を画面で説明して最終確認を得る。
2. **削除要求の登録**：サーバー側でUID、要求ID、状態、作成時刻を記録。クライアントから任意UIDを指定させない。
3. **書き込み停止**：削除中フラグをサーバー側で設定し、同期・投稿・共有・利用枠更新など新規書き込みを拒否する。
4. **関連データ棚卸し**：本人UIDを含む全コレクション、サブコレクション、共有先ミラー、Storage、Functions管理の補助データを列挙する。ページングと件数上限を設ける。
5. **共有関係の整理**：共有ルーム・共有買い物データは、本人のアクセス権・参加関係を解除し、他者所有データは維持する。本人が所有する共有物を削除／引継ぎする場合は、他参加者への影響を事前に説明する。
6. **個人データの削除**：確定した対象をバッチ処理で削除。各バッチの完了位置を記録し、タイムアウト後も再開可能にする。
7. **保持例外の処理**：通報・安全対応・法令上の保持対象について、必要最小限化、識別情報の分離／仮名化、閲覧権限、保持期限を別ポリシーで管理する。保持根拠が未確定なら自動削除しない。
8. **Auth削除**：Firestore等の削除完了と保持例外処理の記録が確認できた後、Admin SDKでAuthユーザーを削除する。
9. **完了確認**：再検索で削除対象が残っていないこと、共有先に不整合がないこと、保持例外だけが残ることを確認し、要求状態を完了にする。
10. **端末処理**：現在の端末のアプリ保存データを消去し、ログアウト状態へ戻す。完了画面では、別端末・外部エクスポート・バックアップの扱いを案内する。

## 状態・再試行

- 状態例：`requested` → `writes_blocked` → `deleting` → `auth_deleting` → `completed`。失敗時は `retry_required` とし、失敗した対象・処理段階・再試行回数を記録する。
- 要求IDとUIDの組み合わせに一意性を持たせ、同じ要求の再実行は冪等にする。
- Authユーザー削除前に失敗した場合、本人の再ログインを必須にせず、管理された削除ジョブが再開できるようにする。
- 削除ジョブ自体に個人情報や削除対象本文を複製しない。ログにはUID以外の不要な内容を出さない。
- 管理者による手動再実行・停止・監査は最小権限で行い、操作履歴を残す。

## 実装前に責任者が決めること

- 対象地域の法令・利用規約に基づく通報記録等の保持根拠と保持期間。
- 共有データの所有権、他の参加者への通知、所有者削除時の扱い。
- Storage・Analytics・ログ・バックアップ等、現行コード外の保存先の有無と削除可能範囲。
- 本人確認・再認証方法、削除要求後の取消可否、問い合わせ窓口。
- 削除処理の運営責任者、失敗時の対応時間、完了通知方法。

## 必須テスト

- 未認証、別UID指定、再認証失敗、削除中の新規書き込み拒否。
- 同一要求の二重実行、途中タイムアウト、Functions再起動後の再開。
- 共有データで本人分だけを解除し、他利用者の所有データを残すこと。
- 通報記録の保持例外と閲覧権限が意図どおりであること。
- 全Firestoreコレクション・サブコレクション・Storage・補助記録の残存確認。
- Auth削除失敗時の再試行と、Auth削除後に完了状態を確定できること。
- 端末内データ消去、ログアウト、別端末に残るデータの案内。

## 現在の判定

- このファイルは設計仕様のみ。削除UI/API/Cloud Function、削除ジョブ、実行テストは未実装。
- 通報保持、共有データ所有権、外部バックアップ等の運用判断が未確定。
- 本番アカウントを使った削除試験は行わない。テスト専用アカウントと隔離環境で検証する。
- 完了するまで一般公開のブロッカーとする。
