# MEMBER_CONTRACT エンティティ定義

| 論理名 | 物理名 | 型 | 必須 | 制約 | 例 | 出所 | 利用先 | PII | 備考 |
|--------|--------|-----|------|------|----|------|--------|-----|------|
| 契約ID | id | UUID | ○ | PK | `uuid-xxxx` | システム | — | — | |
| メンバーID | member_id | UUID | ○ | FK → MEMBER.id | — | 採用連携 | M1-02 契約一覧 | — | |
| 契約ステータス | status | ENUM | ○ | `draft`/`sent`/`waiting_sign`/`completed`/`voided` | `sent` | DocuSign webhook | M1-02 表示 | — | |
| テンプレート名 | template_name | VARCHAR(100) | ○ | — | `雇用契約書_v1` | システム | M1-03 送信時 | — | |
| 契約開始日 | start_date | DATE | 任意 | — | `2026-04-01` | M1-03 入力 | PL/請求に参考 | — | |
| 契約終了日 | end_date | DATE | 任意 | — | — | M1-03 入力 | — | — | |
| 契約書ファイルURL | file_url | TEXT | 条件付 | 署名後は必須 | `https://.../contract.pdf` | DocuSign | M1-02 ダウンロード | △ | S3等への保存 |
| 署名要求日時 | sent_at | TIMESTAMPTZ | — | — | — | DocuSign送信 | M1-02 | — | |
| 締結日時 | completed_at | TIMESTAMPTZ | — | — | — | DocuSign webhook | M1-02 | — | |
| 署名者メール | signer_email | VARCHAR(255) | ○ | メール形式 | `yamada@example.com` | 採用連携 | DocuSign送信 | ○ | 本人のみ閲覧 |
| 契約PDFハッシュ | file_hash | VARCHAR(128) | — | SHA256等 | — | 生成時 | 改ざん検知 | — | |
| 作成日時 | created_at | TIMESTAMPTZ | ○ | DEFAULT NOW() | — | システム | — | — | |
| 更新日時 | updated_at | TIMESTAMPTZ | ○ | ON UPDATE NOW() | — | システム | — | — | |

## 関連
- MEMBER 1:N MEMBER_CONTRACT
- 契約書PDFはストレージ（例: S3）に保存し、本人と管理者のみ署名URL/ファイルURLを返す
- DocuSign送信/完了Webhookで status と file_url を更新

