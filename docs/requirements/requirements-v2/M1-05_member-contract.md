# M1-05 メンバー契約書管理 — 要件定義 v2（確定版）

> 作成日: 2026-02-20（新規作成）
> 参照: docs/requirements/data/member_contract.md

---

## 概要

メンバーごとの契約書（雇用契約書・業務委託契約書等）をDocuSign経由で管理する。
署名済みPDFはストレージ（S3互換）に保存し、本人と管理者のみアクセスできる。

---

## 機能要件（確定）

| 優先度 | 要件 |
|--------|------|
| Must | メンバー詳細（M1-02）内の「契約書」セクションで契約書一覧（ステータス・テンプレート名・契約期間・締結日）を表示する |
| Must | 管理者は契約書を新規作成できる（テンプレート名・署名者メール・契約期間を入力） |
| Must | 管理者が「署名依頼送信」ボタンを押すと DocuSign API 経由で署名依頼メールを送信する |
| Must | DocuSign の Webhook で `completed` / `voided` ステータスを受信して DB を更新する |
| Must | 署名完了後、管理者・本人のみ署名済み PDF のダウンロード URL を取得できる |
| Must | 本人は契約書一覧を閲覧のみ（作成・削除は管理者のみ） |
| Must | マネージャー・社員（本人以外）・インターン（本人以外）は契約書情報を閲覧できない |
| Must | 管理者は `voided`（無効化）操作ができる |
| Should | 契約書ステータスをバッジで表示する（下書き / 送信済 / 署名待ち / 完了 / 無効） |
| Should | `file_hash`（SHA256）で改ざん検知ができる |

---

## データ要件（確定）

テーブル: `member_contracts`

| フィールド | 物理名 | 型 | 必須 | 制約 |
|-----------|--------|-----|------|------|
| メンバーID | `member_id` | UUID | ○ | FK → members |
| ステータス | `status` | ENUM | ○ | `draft`/`sent`/`waiting_sign`/`completed`/`voided` |
| テンプレート名 | `template_name` | VARCHAR(100) | ○ | 最大 100 文字 |
| 契約開始日 | `start_date` | DATE | — | — |
| 契約終了日 | `end_date` | DATE | — | start_date 以降 |
| 契約書ファイルURL | `file_url` | TEXT | 条件付 | 完了後は必須（S3パス） |
| ファイルハッシュ | `file_hash` | VARCHAR(128) | — | SHA256 |
| 署名者メール | `signer_email` | VARCHAR(255) | ○ | PII・本人のみ閲覧 |
| 署名依頼日時 | `sent_at` | TIMESTAMPTZ | — | DocuSign 送信時 |
| 締結日時 | `completed_at` | TIMESTAMPTZ | — | DocuSign webhook 受信時 |

**ステータス遷移:**
```
draft → sent（署名依頼送信） → waiting_sign（DocuSign受信） → completed（署名完了）
                                                               └→ voided（無効化）
```

---

## DocuSign 連携仕様（確定）

| 処理 | 内容 |
|------|------|
| 送信 | DocuSign Envelopes API で `signer_email` 宛に署名依頼を作成。`member_contracts.status` を `sent` に更新 |
| Webhook | DocuSign Connect から `POST /api/webhooks/docusign` を受信。`completed` → `file_url` / `file_hash` を保存 |
| PDF 取得 | DocuSign Envelopes API の `documents/combined` から PDF を取得し、S3 互換ストレージに保存 |
| ダウンロードURL | S3 署名付き URL（有効期限 5 分）を発行 |

---

## 非機能要件（確定）

| 区分 | 内容 |
|------|------|
| 性能 | 署名依頼送信 API 応答 2 秒以内（DocuSign API 呼び出し含む） |
| セキュリティ | `file_url` / `signer_email` は管理者・本人のみ返す。Webhook は DocuSign のリクエスト署名を検証する（`X-DocuSign-Signature-1` ヘッダー） |
| 監査 | 契約書の作成・送信・無効化を `audit_logs` に記録（`signer_email` はマスク） |
| ログ | DocuSign API エラー・Webhook 受信をサーバーログに記録 |
| 可用性 | DocuSign API 障害時でも DB の既存データ参照は正常動作すること |

---

## 運用要件

| 項目 | 内容 |
|------|------|
| バックアップ | `member_contracts` は日次バックアップ対象。S3 の PDF はバージョニングで管理 |
| データ保持 | 署名済み PDF は永久保持（雇用契約書の法定保存義務） |
| DocuSign 認証 | DocuSign OAuth2 の Client ID / Secret は環境変数 `DOCUSIGN_CLIENT_ID` 等で管理 |
| Webhook 検証 | `DOCUSIGN_HMAC_KEY` で署名を検証。不正リクエストは 401 を返しログに記録 |

---

## 受け入れ条件（確定）

- [ ] 管理者がテンプレート名・署名者メール・契約期間を入力して契約書レコードを作成できる
- [ ] 管理者が「署名依頼送信」を押すと DocuSign 経由で署名依頼メールが送信される
- [ ] DocuSign Webhook 受信後に `status` が `completed` に更新され、`file_url` が保存される
- [ ] 完了後に管理者・本人が PDF のダウンロード URL を取得できる
- [ ] 本人がアクセスすると契約書一覧が閲覧できる（作成・削除ボタンは非表示）
- [ ] マネージャー・社員（本人以外）がアクセスすると契約書情報は表示されない
- [ ] 管理者が「無効化」を実行すると `status` が `voided` になる
- [ ] Webhook リクエストの署名検証が失敗すると 401 を返しログに記録される
- [ ] `audit_logs` に契約書操作のレコードが追加されている

---

## ページ配置

独立したページは設けず、**M1-02 メンバー詳細の内部セクション**として実装する。
管理者が契約書を作成・送信する際はモーダルダイアログを使用する。
