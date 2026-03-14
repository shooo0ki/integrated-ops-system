# DB設計書（リバースエンジニアリング版）

> **目的**: 既存の Prisma スキーマから「今の DB がどうなっているか」を正確に言語化したもの。
> **対象**: integrated-ops-system（統合業務管理システム）
> **作成日**: 2026-03-14
> **ソース**: `prisma/schema.prisma`

---

## 1. データベース構成

| 項目 | 値 |
|------|-----|
| DBMS | PostgreSQL |
| ホスティング | Supabase |
| ORM | Prisma Client |
| 接続方式 | `DATABASE_URL`（プーリング経由）+ `DIRECT_URL`（マイグレーション用） |
| テーブル数 | 20 |
| Enum 数 | 13 |

---

## 2. ER図（テキスト版）

```
┌──────────────┐     1:1     ┌──────────────┐
│ UserAccount  │────────────▶│    Member     │
└──────┬───────┘             └──────┬───────┘
       │                            │
       │ 1:N                        ├─ 1:N ─▶ MemberSkill ──▶ Skill ──▶ SkillCategory
       │                            ├─ 1:N ─▶ ProjectAssignment ──▶ Project
       │                            │                                    │
       ├─▶ Project (creator)        │                                    ├─ 1:N ─▶ ProjectPosition
       ├─▶ ProjectAssignment        │                                    │              │
       ├─▶ MemberSkill (evaluator)  │                                    │              └─▶ PositionRequiredSkill
       ├─▶ PLRecord (creator)       │                                    └─ 1:N ─▶ PLRecord
       ├─▶ SystemConfig (updater)   ├─ 1:N ─▶ WorkSchedule
       ├─▶ AuditLog (operator)      ├─ 1:N ─▶ Attendance
       └─▶ PersonnelEvaluation      ├─ 1:N ─▶ Invoice ──▶ InvoiceItem
           (evaluator)              ├─ 1:N ─▶ MemberTool
                                    ├─ 1:N ─▶ MemberContract
                                    ├─ 1:N ─▶ MonthlySelfReport ──▶ Project?
                                    ├─ 1:N ─▶ PersonnelEvaluation
                                    └─ 1:N ─▶ MonthlyAttendanceSummary
```

---

## 3. Enum 定義

### 3-1. UserRole（ユーザー権限）

| 値 | 日本語 | 説明 |
|----|--------|------|
| `admin` | 管理者 | 全機能の閲覧・編集・削除・設定変更 |
| `manager` | マネージャー | ほぼ全機能の閲覧・編集（削除一部制限） |
| `member` | メンバー | 自分のデータの閲覧・一部入力 |

### 3-2. MemberStatus（メンバーステータス）

| 値 | 日本語 | ロールとの対応 |
|----|--------|----------------|
| `executive` | 役員 | → admin |
| `employee` | 社員 | → manager |
| `intern_full` | インターン（長期） | → member |
| `intern_training` | インターン（研修） | → member |
| `training_member` | 研修生 | → member |

### 3-3. SalaryType（給与種別）

| 値 | 日本語 | PL計算への影響 |
|----|--------|----------------|
| `hourly` | 時給制 | 人件費 = salaryAmount × 実働時間 |
| `monthly` | 月給制 | 人件費 = salaryAmount × (申告時間比率) |

### 3-4. ProjectStatus（プロジェクトステータス）

| 値 | 日本語 |
|----|--------|
| `planning` | 計画中 |
| `active` | 進行中 |
| `completed` | 完了 |
| `on_hold` | 一時停止 |

### 3-5. Company（会社）

| 値 | 日本語 |
|----|--------|
| `boost` | Boost |
| `salt2` | SALT2 |

### 3-6. ProjectType（プロジェクト種別）

| 値 | 日本語 | 説明 |
|----|--------|------|
| `boost_dispatch` | Boost 派遣 | Boost 経由の派遣案件。マークアップ率あり。 |
| `salt2_own` | SALT2 自社 | SALT2 の自社案件。 |

### 3-7. ContractType（契約種別）

| 値 | 日本語 |
|----|--------|
| `quasi_mandate` | 準委任 |
| `contract` | 請負 |
| `in_house` | 社内 |
| `other` | その他 |

### 3-8. AttendanceStatus（勤怠ステータス）

| 値 | 日本語 | 説明 |
|----|--------|------|
| `normal` | 通常 | 通常の打刻 |
| `modified` | 修正済み | メンバーが修正した（承認待ち） |
| `absent` | 欠勤 | 欠勤扱い |

### 3-9. ConfirmStatus（確認ステータス）

| 値 | 日本語 | 説明 |
|----|--------|------|
| `unconfirmed` | 未確認 | 初期状態 |
| `confirmed` | 確認済み | 管理者が確認 |
| `approved` | 承認済み | 最終承認 |
| `rejected` | 却下 | 修正申請を却下 |

### 3-10. InvoiceStatus（請求書ステータス）

| 値 | 日本語 | 説明 |
|----|--------|------|
| `unsent` | 未提出 | 生成済みだが未送付 |
| `sent` | 提出済み | アプリ内で提出 |
| `confirmed` | 確認済み | 管理者が LayerX 等へ転送済み |

### 3-11. PLRecordType（PLレコード種別）

| 値 | 説明 |
|----|------|
| `pl` | 損益計算レコード |
| `cf` | キャッシュフローレコード |

### 3-12. MemberContractStatus（契約ステータス）

| 値 | 日本語 |
|----|--------|
| `draft` | 下書き |
| `sent` | 送付済み |
| `waiting_sign` | 署名待ち |
| `completed` | 締結完了 |
| `voided` | 無効 |

### 3-13. AuditAction（監査アクション）

| 値 | 説明 |
|----|------|
| `CREATE` | 作成 |
| `UPDATE` | 更新 |
| `DELETE` | 削除 |

---

## 4. テーブル定義

### 4-1. user_accounts（ユーザーアカウント）

| カラム名 | 型 | 制約 | 説明 |
|----------|-----|------|------|
| id | uuid | PK, default(uuid) | |
| email | varchar(255) | UNIQUE, NOT NULL | ログインメール |
| password_hash | text | NOT NULL | bcryptjs ハッシュ |
| role | UserRole enum | NOT NULL | admin / manager / member |
| member_id | uuid | UNIQUE, FK→members.id, NOT NULL | 対応するメンバー |
| created_at | timestamp | default(now) | |
| updated_at | timestamp | auto | |

**リレーション:**
- `member_id` → members.id（1:1）

---

### 4-2. members（メンバー）

| カラム名 | 型 | 制約 | 説明 |
|----------|-----|------|------|
| id | uuid | PK, default(uuid) | |
| name | varchar(100) | NOT NULL | 氏名 |
| profile_image_url | text | nullable | プロフィール画像URL |
| phone | varchar(20) | nullable | 電話番号 |
| address | text | nullable | 住所 |
| status | MemberStatus enum | NOT NULL | 役員/社員/インターン等 |
| salary_type | SalaryType enum | NOT NULL | 時給制/月給制 |
| salary_amount | int | NOT NULL | 給与額（月給 or 時給） |
| bank_name | text | nullable | 銀行名 |
| bank_branch | text | nullable | 支店名 |
| bank_account_number | text | nullable | 口座番号 |
| bank_account_holder | text | nullable | 口座名義 |
| joined_at | date | NOT NULL | 入社日 |
| left_at | date | nullable | 退社日 |
| deleted_at | timestamp | nullable | ソフトデリート用 |
| created_at | timestamp | default(now) | |
| updated_at | timestamp | auto | |

**インデックス:**
- `@@index([deletedAt])`
- `@@index([leftAt])`
- `@@index([status])`
- `@@index([deletedAt, leftAt])`

**リレーション:**
- 1:1 ← user_accounts（逆方向）
- 1:N → member_skills, project_assignments, work_schedules, attendances, invoices, member_tools, member_contracts, monthly_self_reports, personnel_evaluations, monthly_attendance_summaries

---

### 4-3. skill_categories（スキルカテゴリ）

| カラム名 | 型 | 制約 | 説明 |
|----------|-----|------|------|
| id | uuid | PK, default(uuid) | |
| name | varchar(50) | UNIQUE, NOT NULL | カテゴリ名 |
| description | varchar(200) | nullable | 説明 |
| display_order | int | default(1) | 表示順 |
| created_at | timestamp | default(now) | |
| updated_at | timestamp | auto | |

**リレーション:**
- 1:N → skills

---

### 4-4. skills（スキル）

| カラム名 | 型 | 制約 | 説明 |
|----------|-----|------|------|
| id | uuid | PK, default(uuid) | |
| category_id | uuid | FK→skill_categories.id, NOT NULL | 所属カテゴリ |
| name | varchar(100) | NOT NULL | スキル名 |
| description | varchar(200) | nullable | 説明 |
| display_order | int | default(1) | 表示順 |
| created_at | timestamp | default(now) | |
| updated_at | timestamp | auto | |

**ユニーク制約:** `@@unique([category_id, name])`
**インデックス:**
- `@@index([category_id])`
- `@@index([category_id, display_order])`

---

### 4-5. member_skills（メンバースキル評価）

| カラム名 | 型 | 制約 | 説明 |
|----------|-----|------|------|
| id | uuid | PK, default(uuid) | |
| member_id | uuid | FK→members.id, NOT NULL | 評価対象メンバー |
| skill_id | uuid | FK→skills.id, NOT NULL | 評価対象スキル |
| level | int | NOT NULL | スキルレベル（1-5） |
| evaluated_at | date | NOT NULL | 評価日 |
| memo | varchar(500) | nullable | 評価メモ |
| evaluated_by | uuid | FK→user_accounts.id, NOT NULL | 評価者 |
| created_at | timestamp | default(now) | |

**インデックス:**
- `@@index([member_id, skill_id, evaluated_at DESC])`
- `@@index([skill_id])`
- `@@index([evaluated_by])`

**備考:** 同一メンバー×スキルの履歴を保持。最新の評価を取得するには `evaluated_at DESC` + `DISTINCT ON` or `take: 1`。

---

### 4-6. projects（プロジェクト）

| カラム名 | 型 | 制約 | 説明 |
|----------|-----|------|------|
| id | uuid | PK, default(uuid) | |
| name | varchar(200) | NOT NULL | プロジェクト名 |
| description | text | nullable | 説明 |
| status | ProjectStatus enum | NOT NULL | 計画中/進行中/完了/一時停止 |
| company | Company enum | NOT NULL | boost / salt2 |
| project_type | ProjectType enum | default(salt2_own) | boost_dispatch / salt2_own |
| start_date | date | NOT NULL | 開始日 |
| end_date | date | nullable | 終了日 |
| client_name | varchar(200) | nullable | 顧客名 |
| contract_type | ContractType enum | nullable | 契約種別 |
| monthly_contract_amount | int | default(0) | 月額契約金額（円） |
| created_by | uuid | FK→user_accounts.id, NOT NULL | 作成者 |
| deleted_at | timestamp | nullable | ソフトデリート用 |
| created_at | timestamp | default(now) | |
| updated_at | timestamp | auto | |

**インデックス:**
- `@@index([status])`
- `@@index([company])`
- `@@index([deletedAt])`
- `@@index([status, deletedAt])`

---

### 4-7. project_positions（プロジェクトポジション）

| カラム名 | 型 | 制約 | 説明 |
|----------|-----|------|------|
| id | uuid | PK, default(uuid) | |
| project_id | uuid | FK→projects.id, NOT NULL | 所属プロジェクト |
| position_name | varchar(100) | NOT NULL | ポジション名（PM, エンジニア等） |
| required_count | int | default(1) | 必要人数 |
| created_at | timestamp | default(now) | |
| updated_at | timestamp | auto | |

**インデックス:** `@@index([project_id])`

---

### 4-8. position_required_skills（ポジション必要スキル）

| カラム名 | 型 | 制約 | 説明 |
|----------|-----|------|------|
| id | uuid | PK, default(uuid) | |
| position_id | uuid | FK→project_positions.id, NOT NULL | 対象ポジション |
| skill_id | uuid | FK→skills.id, NOT NULL | 必要スキル |
| min_level | int | NOT NULL | 最低レベル（1-5） |

**ユニーク制約:** `@@unique([position_id, skill_id])`
**インデックス:** `@@index([skill_id])`

**備考:** UI 未実装。DB 上のみ存在。

---

### 4-9. project_assignments（プロジェクトアサイン）

| カラム名 | 型 | 制約 | 説明 |
|----------|-----|------|------|
| id | uuid | PK, default(uuid) | |
| project_id | uuid | FK→projects.id, NOT NULL | 対象プロジェクト |
| position_id | uuid | FK→project_positions.id, NOT NULL | 対象ポジション |
| member_id | uuid | FK→members.id, NOT NULL | アサインされたメンバー |
| workload_hours | int | NOT NULL | 月間工数（時間） |
| start_date | date | NOT NULL | アサイン開始日 |
| end_date | date | nullable | アサイン終了日 |
| created_by | uuid | FK→user_accounts.id, NOT NULL | 作成者 |
| created_at | timestamp | default(now) | |
| updated_at | timestamp | auto | |

**インデックス:**
- `@@index([project_id])`
- `@@index([member_id])`
- `@@index([member_id, start_date, end_date])`
- `@@index([project_id, start_date])`

---

### 4-10. work_schedules（勤務予定）

| カラム名 | 型 | 制約 | 説明 |
|----------|-----|------|------|
| id | uuid | PK, default(uuid) | |
| member_id | uuid | FK→members.id, NOT NULL | 対象メンバー |
| date | date | NOT NULL | 日付 |
| start_time | varchar(5) | nullable | 開始時刻（HH:MM） |
| end_time | varchar(5) | nullable | 終了時刻（HH:MM） |
| is_off | boolean | default(false) | 終日休み |
| location_type | varchar(20) | default("office") | 出社 / online |
| created_at | timestamp | default(now) | |
| updated_at | timestamp | auto | |

**ユニーク制約:** `@@unique([member_id, date])`
**インデックス:**
- `@@index([date])`
- `@@index([member_id, is_off, date])`

---

### 4-11. attendances（勤怠）

| カラム名 | 型 | 制約 | 説明 |
|----------|-----|------|------|
| id | uuid | PK, default(uuid) | |
| member_id | uuid | FK→members.id, NOT NULL | 対象メンバー |
| date | date | NOT NULL | 日付 |
| clock_in | timestamp | nullable | 出勤時刻 |
| clock_out | timestamp | nullable | 退勤時刻 |
| break_minutes | int | default(0) | 休憩時間（分） |
| work_minutes | int | nullable | 実働時間（分）。退勤時に計算。 |
| todo_today | varchar(500) | nullable | 今日やること |
| done_today | varchar(500) | nullable | 今日やったこと |
| todo_tomorrow | varchar(500) | nullable | 次回やること |
| status | AttendanceStatus enum | default(normal) | normal/modified/absent |
| confirm_status | ConfirmStatus enum | default(unconfirmed) | 確認フロー状態 |
| location_type | varchar(20) | default("office") | 出社 / online |
| slack_notified | boolean | default(false) | Slack通知済みフラグ |
| created_at | timestamp | default(now) | |
| updated_at | timestamp | auto | |

**ユニーク制約:** `@@unique([member_id, date])`
**インデックス:**
- `@@index([date])`
- `@@index([status, confirm_status])`
- `@@index([confirm_status, date])`

---

### 4-12. invoices（請求書）

| カラム名 | 型 | 制約 | 説明 |
|----------|-----|------|------|
| id | uuid | PK, default(uuid) | |
| invoice_number | varchar(20) | UNIQUE, NOT NULL | 請求書番号（自動採番） |
| member_id | uuid | FK→members.id, NOT NULL | 対象メンバー |
| target_month | char(7) | NOT NULL | 対象月（YYYY-MM） |
| work_hours_total | decimal(6,2) | default(0) | 合計実働時間 |
| unit_price | int | NOT NULL | 単価 |
| amount_excl_tax | int | default(0) | 税抜金額 |
| amount_incl_tax | int | default(0) | 税込金額 |
| amount_boost | int | default(0) | Boost 配分額 |
| amount_salt2 | int | default(0) | SALT2 配分額 |
| expense_amount | int | default(0) | 非課税経費合計 |
| file_path | text | nullable | PDF ファイルパス |
| status | InvoiceStatus enum | default(unsent) | 提出ステータス |
| issued_at | date | NOT NULL | 発行日 |
| created_at | timestamp | default(now) | |
| updated_at | timestamp | auto | |

**ユニーク制約:** `@@unique([member_id, target_month])`
**インデックス:** `@@index([target_month])`

---

### 4-13. invoice_items（請求書明細行）

| カラム名 | 型 | 制約 | 説明 |
|----------|-----|------|------|
| id | uuid | PK, default(uuid) | |
| invoice_id | uuid | FK→invoices.id (onDelete: Restrict), NOT NULL | 親請求書 |
| name | varchar(200) | NOT NULL | 品名 |
| amount | int | NOT NULL | 金額（円） |
| sort_order | int | default(0) | 並び順 |
| taxable | boolean | default(true) | 課税対象か |
| linked_project_id | uuid | nullable | 紐付きプロジェクトID |

**インデックス:**
- `@@index([invoice_id])`
- `@@index([linked_project_id])`

**備考:** `onDelete: Restrict` により、明細行がある請求書は削除できない（先に明細を削除する必要がある）。

---

### 4-14. pl_records（PLレコード）

| カラム名 | 型 | 制約 | 説明 |
|----------|-----|------|------|
| id | uuid | PK, default(uuid) | |
| record_type | PLRecordType enum | NOT NULL | pl / cf |
| project_id | uuid | FK→projects.id (onDelete: Restrict), nullable | 対象プロジェクト |
| target_month | char(7) | NOT NULL | 対象月（YYYY-MM） |
| revenue_contract | int | default(0) | 契約売上 |
| revenue_extra | int | default(0) | 追加売上 |
| cost_labor_monthly | int | default(0) | 人件費（月給制） |
| cost_labor_hourly | int | default(0) | 人件費（時給制） |
| cost_outsourcing | int | default(0) | 外注費 |
| cost_tools | int | default(0) | ツール費 |
| cost_other | int | default(0) | その他費用 |
| gross_profit | int | default(0) | 粗利 |
| gross_profit_rate | decimal(5,2) | nullable | 粗利率（%） |
| markup_rate | decimal(5,3) | nullable | マークアップ率 |
| cf_company | Company enum | nullable | CF用の会社区分 |
| cf_cash_in_client | int | default(0) | CF: 顧客入金 |
| cf_cash_in_other | int | default(0) | CF: その他入金 |
| cf_cash_out_salary | int | default(0) | CF: 給与支出 |
| cf_cash_out_outsourcing | int | default(0) | CF: 外注費支出 |
| cf_cash_out_fixed | int | default(0) | CF: 固定費支出 |
| cf_cash_out_other | int | default(0) | CF: その他支出 |
| cf_balance_prev | int | nullable | CF: 前月残高 |
| cf_balance_current | int | default(0) | CF: 当月残高 |
| memo | varchar(200) | nullable | メモ |
| created_by | uuid | FK→user_accounts.id, NOT NULL | 作成者 |
| created_at | timestamp | default(now) | |
| updated_at | timestamp | auto | |

**ユニーク制約:** `@@unique([project_id, target_month, record_type])`
**インデックス:**
- `@@index([project_id, target_month])`
- `@@index([target_month, record_type])`

**備考:**
- `record_type = pl` の場合: PL 用フィールド（revenue_*, cost_*, gross_*）を使用
- `record_type = cf` の場合: CF 用フィールド（cf_*）を使用
- 1つのテーブルで PL と CF を共存させている（Single Table Inheritance 的）

---

### 4-15. member_tools（メンバーツール）

| カラム名 | 型 | 制約 | 説明 |
|----------|-----|------|------|
| id | uuid | PK, default(uuid) | |
| member_id | uuid | FK→members.id, NOT NULL | 利用メンバー |
| tool_name | varchar(100) | NOT NULL | ツール名 |
| plan | varchar(50) | nullable | プラン名 |
| monthly_cost | int | default(0) | 月額費用（円） |
| company_label | Company enum | NOT NULL | 所属会社（boost/salt2） |
| note | varchar(200) | nullable | メモ |
| created_at | timestamp | default(now) | |
| updated_at | timestamp | auto | |

**インデックス:**
- `@@index([member_id])`
- `@@index([company_label])`

---

### 4-16. member_contracts（メンバー契約）

| カラム名 | 型 | 制約 | 説明 |
|----------|-----|------|------|
| id | uuid | PK, default(uuid) | |
| member_id | uuid | FK→members.id, NOT NULL | 対象メンバー |
| status | MemberContractStatus enum | default(draft) | 契約ステータス |
| template_name | varchar(100) | NOT NULL | テンプレート名 |
| start_date | date | nullable | 契約開始日 |
| end_date | date | nullable | 契約終了日 |
| docusign_template_id | varchar(100) | nullable | DocuSign テンプレートID |
| envelope_id | varchar(100) | nullable | DocuSign エンベロープID |
| file_url | text | nullable | PDF ファイルURL |
| file_hash | varchar(128) | nullable | PDF ハッシュ（SHA256） |
| signer_email | varchar(255) | NOT NULL | 署名者メールアドレス |
| sent_at | timestamp | nullable | 送付日時 |
| completed_at | timestamp | nullable | 署名完了日時 |
| created_at | timestamp | default(now) | |
| updated_at | timestamp | auto | |

**インデックス:**
- `@@index([member_id])`
- `@@index([status])`
- `@@index([envelope_id])`

---

### 4-17. audit_logs（監査ログ）

| カラム名 | 型 | 制約 | 説明 |
|----------|-----|------|------|
| id | uuid | PK, default(uuid) | |
| operator_id | uuid | FK→user_accounts.id, NOT NULL | 操作者 |
| target_table | varchar(100) | NOT NULL | 対象テーブル名 |
| target_id | uuid | NOT NULL | 対象レコードID |
| action | AuditAction enum | NOT NULL | CREATE / UPDATE / DELETE |
| before_data | json | nullable | 変更前データ |
| after_data | json | nullable | 変更後データ |
| ip_address | varchar(45) | NOT NULL | IPアドレス |
| created_at | timestamp | default(now) | |

**インデックス:**
- `@@index([operator_id])`
- `@@index([target_table, target_id])`
- `@@index([created_at])`

**備考:** 現状、プロジェクトの作成時のみ記録されている（他の操作では未記録）。

---

### 4-18. system_configs（システム設定）

| カラム名 | 型 | 制約 | 説明 |
|----------|-----|------|------|
| id | uuid | PK, default(uuid) | |
| key | varchar(100) | UNIQUE, NOT NULL | 設定キー |
| value | text | NOT NULL | 設定値 |
| is_secret | boolean | default(false) | シークレットフラグ |
| updated_by | uuid | FK→user_accounts.id, NOT NULL | 最終更新者 |
| updated_at | timestamp | auto | |

**現在使用中のキー:**
- `company_name`: 親会社名
- `sub_company_name`: 子会社名
- `fiscal_year_start_month`: 会計年度開始月
- `overtime_threshold_hours`: 残業判定時間
- `slack_closing_notification_day`: Slack 締め通知日

---

### 4-19. monthly_self_reports（月次自己申告）

| カラム名 | 型 | 制約 | 説明 |
|----------|-----|------|------|
| id | uuid | PK, default(uuid) | |
| member_id | uuid | FK→members.id, NOT NULL | 申告者 |
| target_month | char(7) | NOT NULL | 対象月（YYYY-MM） |
| project_id | uuid | FK→projects.id, nullable | 対象プロジェクト |
| custom_label | varchar(100) | nullable | カスタム項目名 |
| reported_percent | int | default(0) | 配分%（0-100） |
| reported_hours | decimal(6,2) | nullable | 申告時間（サーバーで%から計算） |
| note | varchar(500) | nullable | メモ |
| submitted_at | timestamp | nullable | 提出日時 |
| created_at | timestamp | default(now) | |
| updated_at | timestamp | auto | |

**ユニーク制約:**
- `@@unique([member_id, target_month, project_id])` — プロジェクト行の重複防止
- `@@unique([member_id, target_month, custom_label])` — カスタム項目の重複防止

**インデックス:**
- `@@index([member_id, target_month])`
- `@@index([project_id, target_month])`
- `@@index([target_month])`

**備考:**
- 各行は `projectId` か `customLabel` のどちらか一方のみ値を持つ
- `reportedPercent` の合計は対象月×メンバーで 100 になるべき（API 側でバリデーション）
- `reportedHours` はサーバーで `MonthlyAttendanceSummary.totalMinutes / 60 * percent / 100` で自動計算

---

### 4-20. personnel_evaluations（人事評価）

| カラム名 | 型 | 制約 | 説明 |
|----------|-----|------|------|
| id | uuid | PK, default(uuid) | |
| member_id | uuid | FK→members.id, NOT NULL | 評価対象 |
| evaluator_id | uuid | FK→user_accounts.id, NOT NULL | 評価者 |
| target_period | char(7) | NOT NULL | 対象月（YYYY-MM） |
| score_p | int | NOT NULL | Professional スコア（1-5） |
| score_a | int | NOT NULL | Appearance スコア（1-5） |
| score_s | int | NOT NULL | Skill スコア（1-5） |
| comment | varchar(1000) | nullable | コメント |
| created_at | timestamp | default(now) | |
| updated_at | timestamp | auto | |

**ユニーク制約:** `@@unique([member_id, target_period])`
**インデックス:**
- `@@index([member_id, target_period DESC])`
- `@@index([evaluator_id])`

**備考:** 同一メンバー×月の評価は1件のみ（上書き更新）。

---

### 4-21. monthly_attendance_summaries（月次勤怠サマリー）

| カラム名 | 型 | 制約 | 説明 |
|----------|-----|------|------|
| member_id | uuid | PK(複合), FK→members.id, NOT NULL | 対象メンバー |
| target_month | char(7) | PK(複合), NOT NULL | 対象月（YYYY-MM） |
| work_days | int | default(0) | 稼働日数 |
| total_minutes | int | default(0) | 合計実働時間（分） |
| updated_at | timestamp | auto | |

**インデックス:** `@@index([target_month])`

**備考:**
- 複合主キー `(member_id, target_month)` — ID カラムなし
- 非正規化テーブル。attendances テーブルの集計結果をキャッシュ
- 勤怠更新時に upsert で同期

---

## 5. マイグレーション履歴

| 日付 | マイグレーション名 | 概要 |
|------|-------------------|------|
| 2026-02-21 | `init` | 初期スキーマ |
| 2026-02-24 | `add_personnel_evaluations` | PersonnelEvaluation モデル追加 |
| 2026-02-24 | `add_invoice_items` | InvoiceItem モデル追加 |
| 2026-02-24 | `add_indexes_and_fk_relations` | インデックス・FK 追加 |
| 2026-02-24 | `fix_high_priority_antipatterns` | 高優先アンチパターン修正 |
| 2026-02-24 | `add_enums_and_fix_ondelete` | Enum 追加・onDelete 修正 |
| 2026-02-24 | `add_location_type` | locationType フィールド追加 |
| 2026-02-27 | `remove_old_tables` | 廃止テーブル削除 |
| 2026-02-27 | `rename_invoice_status` | InvoiceStatus 名変更 |
| 2026-02-27 | `add_expense_and_cf_fields` | 経費・CF フィールド追加 |
| 2026-03-01 | `add_rejected_confirm_status` | ConfirmStatus に rejected 追加 |
| 2026-03-03 | `add_attendance_confirm_status_index` | 勤怠インデックス追加 |
| 2026-03-06 | `add_member_left_at_index` | Member.leftAt インデックス追加 |
| 2026-03-06 | `add_composite_indexes` | 複合インデックス追加 |
| 2026-03-06 | `add_monthly_attendance_summary` | 月次勤怠サマリーテーブル追加 |
| 2026-03-11 | `add_self_report_percent` | reportedPercent フィールド追加 |

---

## 6. データ整合性ルール

### 6-1. ビジネスルール（DBレベルで保証）

| ルール | 実装 |
|--------|------|
| 1メンバー = 1アカウント | user_accounts.member_id に UNIQUE |
| 1メンバー1日1勤怠 | attendances に @@unique([member_id, date]) |
| 1メンバー1日1予定 | work_schedules に @@unique([member_id, date]) |
| 1メンバー1月1請求書 | invoices に @@unique([member_id, target_month]) |
| 1メンバー1月1評価 | personnel_evaluations に @@unique([member_id, target_period]) |
| カテゴリ内スキル名一意 | skills に @@unique([category_id, name]) |
| ポジション×スキル一意 | position_required_skills に @@unique([position_id, skill_id]) |
| PL/CFレコード一意 | pl_records に @@unique([project_id, target_month, record_type]) |
| 請求書番号一意 | invoices.invoice_number に UNIQUE |

### 6-2. ビジネスルール（アプリレベルで保証）

| ルール | 実装場所 |
|--------|----------|
| 自己申告の % 合計 = 100 | `api/self-reports/route.ts` POST |
| スキルレベル 1-5 | `api/members/[id]/skills/route.ts` |
| PAS スコア 1-5 | `api/evaluations/route.ts` |
| パスワード 8文字以上 | `api/members/[id]/profile/password/route.ts` |
| 請求書金額計算 | `api/invoices/route.ts` calcAmounts() |
| 実働時間 = (退勤 - 出勤 - 休憩) | `api/attendances/clock-out/route.ts` |

### 6-3. 削除保護

| テーブル | 保護方式 | 説明 |
|----------|----------|------|
| members | ソフトデリート | `deleted_at` に日時設定。クエリで除外。 |
| projects | ソフトデリート | `deleted_at` に日時設定。クエリで除外。 |
| invoices → invoice_items | onDelete: Restrict | 明細がある請求書は削除不可。 |
| projects → pl_records | onDelete: Restrict | PLレコードがあるプロジェクトは削除不可。 |
