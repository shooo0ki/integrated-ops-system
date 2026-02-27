# DB設計書（カラム定義・設計根拠）

> 最終更新: 2026-02-27（prisma/schema.prisma より自動反映）
> 参照元: prisma/schema.prisma（実装の唯一の正となるスキーマ）

---

## 1. エンティティ一覧

| # | テーブル名（DB） | 論理名 | 区分 | 概要 |
|---|----------------|--------|------|------|
| 1 | user_accounts | ユーザーアカウント | トランザクション | 認証・ロール管理。members と 1:1 |
| 2 | members | メンバー | トランザクション | 人事基本情報。PII（氏名・電話・住所・銀行口座）を含む |
| 3 | skill_categories | スキルカテゴリ | マスタ | スキルの分類（例: フロントエンド・インフラ） |
| 4 | skills | スキル | マスタ | カテゴリ配下のスキル項目 |
| 5 | member_skills | メンバースキル評価 | トランザクション（追記型） | 評価履歴を上書きせず蓄積する |
| 6 | projects | プロジェクト | トランザクション | 案件基本情報 |
| 7 | project_positions | PJポジション | トランザクション | PJ内の役割定義（PM・エンジニア等） |
| 8 | position_required_skills | ポジション必要スキル | トランザクション | ポジション×スキルの最低レベル要件 |
| 9 | project_assignments | アサイン | トランザクション | メンバーをPJポジションに工数込みで割り当て |
| 10 | work_schedules | 勤務予定 | トランザクション | メンバー×日付の勤務予定（週次登録） |
| 11 | attendances | 勤怠 | トランザクション | 日次出退勤打刻・日報・修正申請 |
| 12 | invoices | 請求書 | トランザクション | 月次請求書（時給制メンバー向け、会社別按分額含む） |
| 12b | invoice_items | 請求書明細行 | トランザクション | 請求書ごとの明細行（任意追加） |
| 13 | pl_records | PL / CFレコード | トランザクション | 損益計算（PL）とキャッシュフロー（CF）の月次集計値 |
| 14 | member_tools | メンバー利用ツール | トランザクション | 個人ごとのSaaS等のツール契約・費用 |
| 15 | member_contracts | メンバー契約書 | トランザクション | DocuSign連携の電子契約管理 |
| 16 | audit_logs | 監査ログ | 追記専用 | 全書き込み操作の変更前後を保存 |
| 17 | system_configs | システム設定 | マスタ | Slack Webhook等のシステム設定KV |
| 18 | monthly_self_reports | 月次自己申告 | トランザクション | メンバーのPJ別月次実働申告（確定値） |
| 19 | personnel_evaluations | 人事評価（PAS） | トランザクション | Professional / Appearance / Skill の月次3軸考課 |

---

## 2. Enum 定義

| Enum名 | 値 | 用途 |
|--------|-----|------|
| UserRole | admin / manager / employee / intern | ユーザーのシステム権限ロール |
| MemberStatus | executive / employee / intern_full / intern_training / training_member | メンバーの雇用形態・在籍ステータス |
| SalaryType | hourly / monthly | 給与形態（時給制 / 月給制） |
| ProjectStatus | planning / active / completed / on_hold | プロジェクトの進行状況 |
| Company | boost / salt2 | 所属・負担会社の区分（Boost / SALT2） |
| ProjectType | boost_dispatch / salt2_own | プロジェクト種別（Boost派遣 / SALT2自社案件） |
| ContractType | quasi_mandate / contract / in_house / other | 契約種別（準委任 / 請負 / 自社開発 / その他） |
| AttendanceStatus | normal / modified / absent | 勤怠レコードの状態（通常 / 修正申請中 / 欠勤） |
| ConfirmStatus | unconfirmed / confirmed / approved | 勤怠の確認・承認ステータス |
| SlackSentStatus | unsent / sent / confirmed | 請求書のSlack通知送信状態 |
| PLRecordType | pl / cf | PLレコードの種別（損益計算 / キャッシュフロー） |
| MemberContractStatus | draft / sent / waiting_sign / completed / voided | 電子契約書の締結進捗ステータス |
| AuditAction | CREATE / UPDATE / DELETE | 監査ログの操作種別 |

---

## 3. ER概要

```
USER_ACCOUNTS ──── 1:1 ──── MEMBERS
     │
     └─── created_by / evaluated_by / operator_id として各テーブルに参照

MEMBERS ──── 1:N ──── MEMBER_SKILLS
        ──── 1:N ──── PROJECT_ASSIGNMENTS
        ──── 1:N ──── WORK_SCHEDULES
        ──── 1:N ──── ATTENDANCES
        ──── 1:N ──── INVOICES
        ──── 1:N ──── MEMBER_TOOLS
        ──── 1:N ──── MEMBER_CONTRACTS
        ──── 1:N ──── MONTHLY_SELF_REPORTS
        ──── 1:N ──── PERSONNEL_EVALUATIONS（被評価者として）
        ──── 1:N ──── INTRA_COMPANY_SETTLEMENTS（任意）

SKILL_CATEGORIES ──── 1:N ──── SKILLS
SKILLS ──── 1:N ──── MEMBER_SKILLS
       ──── 1:N ──── POSITION_REQUIRED_SKILLS

PROJECTS ──── 1:N ──── PROJECT_POSITIONS
         ──── 1:N ──── PROJECT_ASSIGNMENTS
         ──── 1:N ──── PL_RECORDS（record_type='pl'）
         ──── 1:N ──── MONTHLY_SELF_REPORTS

PROJECT_POSITIONS ──── 1:N ──── POSITION_REQUIRED_SKILLS
                  ──── 1:N ──── PROJECT_ASSIGNMENTS

INVOICES ──── 1:N ──── INVOICE_ITEMS（ON DELETE RESTRICT）

AUDIT_LOGS ──── append-only ──── 全テーブルの変更操作を記録
SYSTEM_CONFIGS ──── key-value ──── システム設定
```

---

## 4. テーブル定義

---

### 4-1. user_accounts（ユーザーアカウント）

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|-----|------|-----------|------|
| id | UUID | NO | uuid() | PK |
| email | VARCHAR(255) | NO | — | ユニーク。ログインID |
| password_hash | TEXT | NO | — | bcrypt ハッシュ |
| role | UserRole | NO | — | admin / manager / employee / intern |
| member_id | UUID | NO | — | members.id への FK（UNIQUE） |
| created_at | TIMESTAMPTZ | NO | now() | |
| updated_at | TIMESTAMPTZ | NO | — | 自動更新 |

**インデックス:** UNIQUE(email), UNIQUE(member_id)

---

### 4-2. members（メンバー）

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|-----|------|-----------|------|
| id | UUID | NO | uuid() | PK |
| name | VARCHAR(100) | NO | — | 氏名（PII） |
| profile_image_url | TEXT | YES | — | プロフィール画像URL |
| phone | VARCHAR(20) | YES | — | 電話番号（PII） |
| address | TEXT | YES | — | 住所（PII） |
| status | MemberStatus | NO | — | executive / employee / intern_full / intern_training / training_member |
| salary_type | SalaryType | NO | — | hourly / monthly |
| salary_amount | INT | NO | — | 時給制: 時給額、月給制: 月給額（円） |
| bank_name | TEXT | YES | — | 銀行名（PII・将来暗号化予定） |
| bank_branch | TEXT | YES | — | 支店名（PII） |
| bank_account_number | TEXT | YES | — | 口座番号（PII） |
| bank_account_holder | TEXT | YES | — | 口座名義（PII） |
| joined_at | DATE | NO | — | 入社日 |
| left_at | DATE | YES | — | 退社日（NULL = 在籍中） |
| deleted_at | TIMESTAMPTZ | YES | — | 論理削除日時 |
| created_at | TIMESTAMPTZ | NO | now() | |
| updated_at | TIMESTAMPTZ | NO | — | 自動更新 |

**インデックス:** INDEX(deleted_at), INDEX(status)

**NOTE:** UserAccount とは 1:1。role と status の対応はアプリ層で維持する。
銀行情報は Phase 3 で AES-256 暗号化実装予定。

---

### 4-3. skill_categories（スキルカテゴリ）

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|-----|------|-----------|------|
| id | UUID | NO | uuid() | PK |
| name | VARCHAR(50) | NO | — | カテゴリ名（UNIQUE） |
| description | VARCHAR(200) | YES | — | 説明 |
| display_order | INT | NO | 1 | 表示順 |
| created_at | TIMESTAMPTZ | NO | now() | |
| updated_at | TIMESTAMPTZ | NO | — | 自動更新 |

---

### 4-4. skills（スキル）

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|-----|------|-----------|------|
| id | UUID | NO | uuid() | PK |
| category_id | UUID | NO | — | skill_categories.id への FK |
| name | VARCHAR(100) | NO | — | スキル名 |
| description | VARCHAR(200) | YES | — | 説明 |
| display_order | INT | NO | 1 | 表示順 |
| created_at | TIMESTAMPTZ | NO | now() | |
| updated_at | TIMESTAMPTZ | NO | — | 自動更新 |

**インデックス:** UNIQUE(category_id, name), INDEX(category_id), INDEX(category_id, display_order)

---

### 4-5. member_skills（メンバースキル評価）

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|-----|------|-----------|------|
| id | UUID | NO | uuid() | PK |
| member_id | UUID | NO | — | members.id への FK |
| skill_id | UUID | NO | — | skills.id への FK |
| level | INT | NO | — | 評価レベル 1〜5 |
| evaluated_at | DATE | NO | — | 評価日 |
| memo | VARCHAR(500) | YES | — | 評価コメント |
| evaluated_by | UUID | NO | — | user_accounts.id（評価者） |
| created_at | TIMESTAMPTZ | NO | now() | INSERT専用のため updated_at なし |

**インデックス:** INDEX(member_id, skill_id, evaluated_at DESC), INDEX(skill_id), INDEX(evaluated_by)

**NOTE:** 追記型。既存レコードを上書きしない。最新評価は evaluated_at DESC で取得。

---

### 4-6. projects（プロジェクト）

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|-----|------|-----------|------|
| id | UUID | NO | uuid() | PK |
| name | VARCHAR(200) | NO | — | プロジェクト名 |
| description | TEXT | YES | — | 説明 |
| status | ProjectStatus | NO | — | planning / active / completed / on_hold |
| company | Company | NO | — | boost / salt2 |
| project_type | ProjectType | NO | salt2_own | boost_dispatch / salt2_own |
| start_date | DATE | NO | — | 開始日 |
| end_date | DATE | YES | — | 終了日 |
| client_name | VARCHAR(200) | YES | — | クライアント名 |
| contract_type | ContractType | YES | — | quasi_mandate / contract / in_house / other |
| monthly_contract_amount | INT | NO | 0 | 月額契約金額（円） |
| created_by | UUID | NO | — | user_accounts.id（作成者） |
| deleted_at | TIMESTAMPTZ | YES | — | 論理削除日時 |
| created_at | TIMESTAMPTZ | NO | now() | |
| updated_at | TIMESTAMPTZ | NO | — | 自動更新 |

**インデックス:** INDEX(status), INDEX(company), INDEX(deleted_at)

---

### 4-7. project_positions（PJポジション）

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|-----|------|-----------|------|
| id | UUID | NO | uuid() | PK |
| project_id | UUID | NO | — | projects.id への FK |
| position_name | VARCHAR(100) | NO | — | ポジション名（例: バックエンドエンジニア） |
| required_count | INT | NO | 1 | 必要人数 |
| created_at | TIMESTAMPTZ | NO | now() | |
| updated_at | TIMESTAMPTZ | NO | — | 自動更新 |

**インデックス:** INDEX(project_id)

---

### 4-8. position_required_skills（ポジション必要スキル）

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|-----|------|-----------|------|
| id | UUID | NO | uuid() | PK |
| position_id | UUID | NO | — | project_positions.id への FK |
| skill_id | UUID | NO | — | skills.id への FK |
| min_level | INT | NO | — | 最低必要レベル 1〜5 |

**インデックス:** UNIQUE(position_id, skill_id), INDEX(skill_id)

---

### 4-9. project_assignments（アサイン）

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|-----|------|-----------|------|
| id | UUID | NO | uuid() | PK |
| project_id | UUID | NO | — | projects.id への FK |
| position_id | UUID | NO | — | project_positions.id への FK |
| member_id | UUID | NO | — | members.id への FK |
| workload_hours | INT | NO | — | 月間工数（時間） |
| start_date | DATE | NO | — | アサイン開始日 |
| end_date | DATE | YES | — | アサイン終了日 |
| created_by | UUID | NO | — | user_accounts.id（登録者） |
| created_at | TIMESTAMPTZ | NO | now() | |
| updated_at | TIMESTAMPTZ | NO | — | 自動更新 |

**インデックス:** INDEX(project_id), INDEX(member_id), INDEX(member_id, start_date, end_date)

---

### 4-10. work_schedules（勤務予定）

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|-----|------|-----------|------|
| id | UUID | NO | uuid() | PK |
| member_id | UUID | NO | — | members.id への FK |
| date | DATE | NO | — | 予定日 |
| start_time | VARCHAR(5) | YES | — | 開始時刻 "HH:MM" |
| end_time | VARCHAR(5) | YES | — | 終了時刻 "HH:MM" |
| is_off | BOOLEAN | NO | false | 終日休みフラグ |
| location_type | VARCHAR(20) | NO | "office" | 勤務場所: "office" / "online" |
| created_at | TIMESTAMPTZ | NO | now() | |
| updated_at | TIMESTAMPTZ | NO | — | 自動更新 |

**インデックス:** UNIQUE(member_id, date), INDEX(date)

---

### 4-11. attendances（勤怠）

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|-----|------|-----------|------|
| id | UUID | NO | uuid() | PK |
| member_id | UUID | NO | — | members.id への FK |
| date | DATE | NO | — | 勤務日 |
| clock_in | TIMESTAMPTZ | YES | — | 出勤打刻日時 |
| clock_out | TIMESTAMPTZ | YES | — | 退勤打刻日時 |
| break_minutes | INT | NO | 0 | 休憩時間（分） |
| work_minutes | INT | YES | — | 実労働時間（分）。自動計算: (clock_out - clock_in) - break_minutes |
| todo_today | VARCHAR(500) | YES | — | 今日やること（出勤時入力） |
| done_today | VARCHAR(500) | YES | — | 今日やったこと（退勤時入力） |
| todo_tomorrow | VARCHAR(500) | YES | — | 明日やること（退勤時入力） |
| status | AttendanceStatus | NO | normal | normal / modified / absent |
| confirm_status | ConfirmStatus | NO | unconfirmed | unconfirmed / confirmed / approved |
| location_type | VARCHAR(20) | NO | "office" | 勤務場所: "office" / "online" |
| slack_notified | BOOLEAN | NO | false | 月次Slack通知送信済みフラグ |
| created_at | TIMESTAMPTZ | NO | now() | |
| updated_at | TIMESTAMPTZ | NO | — | 自動更新 |

**インデックス:** UNIQUE(member_id, date), INDEX(date), INDEX(status, confirm_status)

---

### 4-12. invoices（請求書）

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|-----|------|-----------|------|
| id | UUID | NO | uuid() | PK |
| invoice_number | VARCHAR(20) | NO | — | 請求書番号（UNIQUE） |
| member_id | UUID | NO | — | members.id への FK |
| target_month | CHAR(7) | NO | — | 対象月 "YYYY-MM" |
| work_hours_total | DECIMAL(6,2) | NO | 0 | 合計稼働時間 |
| unit_price | INT | NO | — | 時給単価（円） |
| amount_excl_tax | INT | NO | 0 | 税抜金額 |
| amount_incl_tax | INT | NO | 0 | 税込金額 |
| amount_boost | INT | NO | 0 | Boost負担額 |
| amount_salt2 | INT | NO | 0 | SALT2負担額 |
| file_path | TEXT | YES | — | PDFファイルパス |
| slack_sent_status | SlackSentStatus | NO | unsent | unsent / sent / confirmed |
| issued_at | DATE | NO | — | 発行日 |
| created_at | TIMESTAMPTZ | NO | now() | |
| updated_at | TIMESTAMPTZ | NO | — | 自動更新 |

**インデックス:** UNIQUE(invoice_number), UNIQUE(member_id, target_month), INDEX(target_month)

---

### 4-12b. invoice_items（請求書明細行）

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|-----|------|-----------|------|
| id | UUID | NO | uuid() | PK |
| invoice_id | UUID | NO | — | invoices.id への FK（ON DELETE RESTRICT） |
| name | VARCHAR(200) | NO | — | 明細名（例: 基本稼働費、交通費） |
| amount | INT | NO | — | 金額（円） |
| sort_order | INT | NO | 0 | 表示順 |

**インデックス:** INDEX(invoice_id)

**NOTE:** ON DELETE RESTRICT で財務履歴を保護。Invoice 削除前に明細を手動削除する運用。

---

### 4-13. pl_records（PL / CFレコード）

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|-----|------|-----------|------|
| id | UUID | NO | uuid() | PK |
| record_type | PLRecordType | NO | — | "pl" / "cf" |
| project_id | UUID | YES | — | projects.id（PL時は必須、CF時はNULL） |
| target_month | CHAR(7) | NO | — | 対象月 "YYYY-MM" |
| revenue_contract | INT | NO | 0 | 契約売上 |
| revenue_extra | INT | NO | 0 | 追加売上 |
| cost_labor_monthly | INT | NO | 0 | 月給制人件費 |
| cost_labor_hourly | INT | NO | 0 | 時給制人件費（自動集計） |
| cost_outsourcing | INT | NO | 0 | 外注費 |
| cost_tools | INT | NO | 0 | ツール費（自動集計） |
| cost_other | INT | NO | 0 | その他コスト |
| gross_profit | INT | NO | 0 | 粗利 = 売上合計 - コスト合計 |
| gross_profit_rate | DECIMAL(5,2) | YES | — | 粗利率（%） |
| markup_rate | DECIMAL(5,3) | YES | — | boost_dispatch の掛け率（例: 1.200） |
| cf_cash_in_client | INT | NO | 0 | CF: クライアント入金 |
| cf_cash_in_other | INT | NO | 0 | CF: その他入金 |
| cf_cash_out_salary | INT | NO | 0 | CF: 給与支出 |
| cf_cash_out_outsourcing | INT | NO | 0 | CF: 外注支出 |
| cf_cash_out_fixed | INT | NO | 0 | CF: 固定費支出 |
| cf_cash_out_other | INT | NO | 0 | CF: その他支出 |
| cf_balance_prev | INT | YES | — | CF: 前月繰越残高 |
| cf_balance_current | INT | NO | 0 | CF: 当月末残高 |
| memo | VARCHAR(200) | YES | — | 備考 |
| created_by | UUID | NO | — | user_accounts.id（作成者） |
| created_at | TIMESTAMPTZ | NO | now() | |
| updated_at | TIMESTAMPTZ | NO | — | 自動更新 |

**インデックス:** UNIQUE(project_id, target_month, record_type), INDEX(project_id, target_month), INDEX(target_month, record_type)

**NOTE:** ON DELETE RESTRICT で財務履歴保護。boost_dispatch の売上 = cost_labor_hourly × markup_rate + cost_tools で自動算出。

---

### 4-14. member_tools（メンバー利用ツール）

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|-----|------|-----------|------|
| id | UUID | NO | uuid() | PK |
| member_id | UUID | NO | — | members.id への FK |
| tool_name | VARCHAR(100) | NO | — | ツール名 |
| plan | VARCHAR(50) | YES | — | プラン名 |
| monthly_cost | INT | NO | 0 | 月額費用（円） |
| company_label | Company | NO | — | 負担会社: boost / salt2 |
| note | VARCHAR(200) | YES | — | 備考 |
| created_at | TIMESTAMPTZ | NO | now() | |
| updated_at | TIMESTAMPTZ | NO | — | 自動更新 |

**インデックス:** INDEX(member_id), INDEX(company_label)

---

### 4-15. member_contracts（メンバー契約書）

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|-----|------|-----------|------|
| id | UUID | NO | uuid() | PK |
| member_id | UUID | NO | — | members.id への FK |
| status | MemberContractStatus | NO | draft | draft / sent / waiting_sign / completed / voided |
| template_name | VARCHAR(100) | NO | — | テンプレート名 |
| start_date | DATE | YES | — | 契約開始日 |
| end_date | DATE | YES | — | 契約終了日 |
| docusign_template_id | VARCHAR(100) | YES | — | DocuSign テンプレートID |
| envelope_id | VARCHAR(100) | YES | — | DocuSign エンベロープID |
| file_url | TEXT | YES | — | 署名済みPDF URL |
| file_hash | VARCHAR(128) | YES | — | SHA256 ハッシュ（改ざん検証用） |
| signer_email | VARCHAR(255) | NO | — | 署名者メール（PII） |
| sent_at | TIMESTAMPTZ | YES | — | 送信日時 |
| completed_at | TIMESTAMPTZ | YES | — | 完了日時 |
| created_at | TIMESTAMPTZ | NO | now() | |
| updated_at | TIMESTAMPTZ | NO | — | 自動更新 |

**インデックス:** INDEX(member_id), INDEX(status), INDEX(envelope_id)

---

### 4-16. audit_logs（監査ログ）

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|-----|------|-----------|------|
| id | UUID | NO | uuid() | PK |
| operator_id | UUID | NO | — | user_accounts.id（操作者） |
| target_table | VARCHAR(100) | NO | — | 操作対象テーブル名 |
| target_id | TEXT | NO | — | 操作対象レコードID |
| action | AuditAction | NO | — | CREATE / UPDATE / DELETE |
| before_data | JSONB | YES | — | 変更前データ |
| after_data | JSONB | YES | — | 変更後データ |
| ip_address | VARCHAR(45) | NO | — | 操作者IPアドレス（IPv6対応） |
| created_at | TIMESTAMPTZ | NO | now() | INSERT専用のため updated_at なし |

**インデックス:** INDEX(operator_id), INDEX(target_table, target_id), INDEX(created_at)

---

### 4-17. system_configs（システム設定）

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|-----|------|-----------|------|
| id | UUID | NO | uuid() | PK |
| key | VARCHAR(100) | NO | — | 設定キー（UNIQUE） |
| value | TEXT | NO | — | 設定値 |
| is_secret | BOOLEAN | NO | false | シークレットフラグ（UI非表示） |
| updated_by | UUID | NO | — | user_accounts.id（最終更新者） |
| updated_at | TIMESTAMPTZ | NO | — | 自動更新 |

---

### 4-18. monthly_self_reports（月次自己申告）

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|-----|------|-----------|------|
| id | UUID | NO | uuid() | PK |
| member_id | UUID | NO | — | members.id への FK |
| target_month | CHAR(7) | NO | — | 対象月 "YYYY-MM" |
| project_id | UUID | NO | — | projects.id への FK |
| reported_hours | DECIMAL(6,2) | NO | — | 申告稼働時間 |
| note | VARCHAR(500) | YES | — | 備考 |
| submitted_at | TIMESTAMPTZ | YES | — | 提出日時（NULL = 下書き） |
| created_at | TIMESTAMPTZ | NO | now() | |
| updated_at | TIMESTAMPTZ | NO | — | 自動更新 |

**インデックス:** UNIQUE(member_id, target_month, project_id), INDEX(member_id, target_month), INDEX(project_id, target_month)

---

### 4-19. personnel_evaluations（人事評価 PAS）

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|-----|------|-----------|------|
| id | UUID | NO | uuid() | PK |
| member_id | UUID | NO | — | members.id（被評価者） |
| evaluator_id | UUID | NO | — | user_accounts.id（評価者。admin のみ） |
| target_period | CHAR(7) | NO | — | 評価対象月 "YYYY-MM" |
| score_p | INT | NO | — | Professional スコア 1〜5 |
| score_a | INT | NO | — | Appearance スコア 1〜5 |
| score_s | INT | NO | — | Skill スコア 1〜5 |
| comment | VARCHAR(1000) | YES | — | 評価コメント |
| created_at | TIMESTAMPTZ | NO | now() | |
| updated_at | TIMESTAMPTZ | NO | — | 自動更新 |

**インデックス:** UNIQUE(member_id, target_period), INDEX(member_id, target_period DESC), INDEX(evaluator_id)

---

## 5. 設計方針

### 5-1. 正規化
- 第3正規形を基本とし、パフォーマンス上必要な場合のみ非正規化（例: work_minutes の事前計算）
- PII（氏名・電話・住所・銀行情報）は members テーブルに集約

### 5-2. 論理削除
- members・projects に `deleted_at` カラムで論理削除
- 財務履歴テーブル（invoices, invoice_items, pl_records）は物理削除禁止（ON DELETE RESTRICT）

### 5-3. 監査
- 書き込み操作は audit_logs にビフォー/アフターをJSON形式で記録
- audit_logs は INSERT 専用（UPDATE・DELETE 禁止）

### 5-4. ID・時刻
- 全PK: UUID v4（`@default(uuid())`）
- タイムゾーン: PostgreSQL TIMESTAMPTZ（JST変換はアプリ層）
- 日付のみのフィールド: `@db.Date`

### 5-5. 勤務場所 (location_type)
- work_schedules・attendances の両テーブルに `location_type VARCHAR(20)` を持つ
- 有効値: `"office"`（出社）/ `"online"`（オンライン）
- デフォルト: `"office"`

### 5-6. PLレコードの掛け率
- boost_dispatch プロジェクトの売上 = `cost_labor_hourly × markup_rate + cost_tools`
- markup_rate は管理者が手動設定可能。PL自動集計時は既存値を優先し上書きしない
- 損益分岐掛け率 = `(cost_labor + cost_other) / cost_labor`
