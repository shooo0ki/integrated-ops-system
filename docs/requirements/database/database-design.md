# DB設計書

> 作成日: 2026-02-20
> 参照元: docs/requirements/data/data-list.md / docs/requirements/data/member_contract.md / docs/requirements/data/member_tool.md

---

## 1. エンティティ一覧

| # | テーブル名 | 論理名 | 区分 | 備考 |
|---|-----------|--------|------|------|
| 1 | user_accounts | ユーザーアカウント | トランザクション | 認証・ロール管理 |
| 2 | members | メンバー | トランザクション | 人事基本情報・PII含む |
| 3 | skill_categories | スキルカテゴリ | マスタ | スキル分類 |
| 4 | skills | スキル | マスタ | スキル項目 |
| 5 | member_skills | メンバースキル評価 | トランザクション（追記型） | 評価履歴保持 |
| 6 | projects | プロジェクト | トランザクション | PJ基本情報 |
| 7 | project_positions | PJポジション | トランザクション | PJ内ポジション定義 |
| 8 | position_required_skills | ポジション必要スキル | トランザクション | ポジション×スキル要件 |
| 9 | project_assignments | アサイン | トランザクション | メンバー×PJ工数割当 |
| 10 | work_schedules | 勤務予定 | トランザクション | 週次勤務予定 |
| 11 | attendances | 勤怠 | トランザクション | 日次出退勤・日報 |
| 12 | invoices | 請求書 | トランザクション | 月次請求書（会社別按分額含む） |
| 13 | pl_records | PL / CFレコード | トランザクション | 損益・キャッシュフロー（ツール費含む） |
| 14 | member_tools | メンバー利用ツール | トランザクション | 個人ごとのツール契約 |
| 15 | member_contracts | メンバー契約書 | トランザクション | DocuSign連携・署名PDF |
| 16 | audit_logs | 監査ログ | 追記専用 | 全書き込み操作の変更前後 |
| 17 | system_configs | システム設定 | マスタ | Slack等のシステム設定キーバリュー |
| 18 | attendance_allocations | 勤怠PJ配分 | トランザクション | 退勤時の自己申告PJ別実働配分（分） |
| 19 | intra_company_settlements | 社内精算 | トランザクション | Boost↔SALT2の月次社内精算レコード |
| 20 | monthly_self_reports | 月次自己申告 | トランザクション | メンバーのPJ別実働申告（月次） |
| 21 | personnel_evaluations | 人事評価（PAS） | トランザクション | P/A/S 3軸月次人事考課、1メンバー×1ヶ月=1レコード |

---

## 2. ER概要（リレーション説明）

```
USER_ACCOUNTS ──── 1:1 ──── MEMBERS
     │
     └─── (created_by / evaluated_by / operator_id として各テーブルに参照)

MEMBERS ──── 1:N ──── MEMBER_SKILLS
        ──── 1:N ──── PROJECT_ASSIGNMENTS
        ──── 1:N ──── WORK_SCHEDULES
        ──── 1:N ──── ATTENDANCES
        ──── 1:N ──── INVOICES
        ──── 1:N ──── MEMBER_TOOLS
        ──── 1:N ──── MEMBER_CONTRACTS
        ──── 1:N ──── PERSONNEL_EVALUATIONS (被評価者)

SKILL_CATEGORIES ──── 1:N ──── SKILLS
SKILLS ──── 1:N ──── MEMBER_SKILLS
       ──── 1:N ──── POSITION_REQUIRED_SKILLS

PROJECTS ──── 1:N ──── PROJECT_POSITIONS
         ──── 1:N ──── PROJECT_ASSIGNMENTS
         ──── 1:N ──── PL_RECORDS (record_type='pl')

PROJECT_POSITIONS ──── 1:N ──── POSITION_REQUIRED_SKILLS
                  ──── 1:N ──── PROJECT_ASSIGNMENTS

INVOICES ──── (給与支払い参照) ──── PL_RECORDS (record_type='cf')

ATTENDANCES ──── 1:N ──── ATTENDANCE_ALLOCATIONS
ATTENDANCE_ALLOCATIONS ──── N:1 ──── PROJECTS

INTRA_COMPANY_SETTLEMENTS ─── monthly ─── BOOST / SALT2 社内精算

AUDIT_LOGS ─── append-only ─── 全テーブルの変更操作を記録

SYSTEM_CONFIGS ─── key-value ─── システム設定（Slack Webhook等）
```

---

## 3. テーブル定義

### 3-1. user_accounts（ユーザーアカウント）

```sql
CREATE TABLE user_accounts (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  email          VARCHAR(255)  NOT NULL,
  password_hash  TEXT          NOT NULL,   -- bcrypt ハッシュ（コスト 12 推奨）
  role           VARCHAR(20)   NOT NULL,   -- 'admin' | 'manager' | 'employee' | 'intern'
  member_id      UUID          NOT NULL    REFERENCES members(id),
  created_at     TIMESTAMPTZ   NOT NULL    DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL    DEFAULT NOW(),

  CONSTRAINT uq_user_accounts_email  UNIQUE (email),
  CONSTRAINT chk_user_accounts_role  CHECK (role IN ('admin','manager','employee','intern'))
);
```

> **注意:** `password_hash` はアプリケーション層で bcrypt（コスト 12）でハッシュ化してから保存する。平文パスワードは DB・ログに一切記録しない。

**インデックス:**
| インデックス名 | 対象カラム | 種別 | 用途 |
|---|---|---|---|
| uq_user_accounts_email | email | UNIQUE | ログイン照合 |
| idx_user_accounts_member_id | member_id | B-tree | JOIN高速化 |

---

### 3-2. members（メンバー）

```sql
CREATE TABLE members (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  VARCHAR(100)  NOT NULL,
  profile_image_url     TEXT,
  phone                 VARCHAR(20),
  address               TEXT,
  status                VARCHAR(30)   NOT NULL,  -- 'executive'|'employee'|'intern_full'|'intern_training'|'training_member'
  company               VARCHAR(10)   NOT NULL,  -- 'boost' | 'salt2'
  salary_type           VARCHAR(10)   NOT NULL,  -- 'hourly' | 'monthly'
  salary_amount         INTEGER       NOT NULL,
  -- 銀行情報：AES-256暗号化済みの文字列を保存
  bank_name             TEXT,                    -- 暗号化
  bank_branch           TEXT,                    -- 暗号化
  bank_account_number   TEXT,                    -- 暗号化
  bank_account_holder   TEXT,                    -- 暗号化
  joined_at             DATE          NOT NULL,
  left_at               DATE,                    -- NULL = 在籍中
  deleted_at            TIMESTAMPTZ,             -- 論理削除
  created_at            TIMESTAMPTZ   NOT NULL   DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL   DEFAULT NOW(),

  CONSTRAINT chk_members_status       CHECK (status IN ('executive','employee','intern_full','intern_training','training_member')),
  CONSTRAINT chk_members_company      CHECK (company IN ('boost','salt2')),
  CONSTRAINT chk_members_salary_type  CHECK (salary_type IN ('hourly','monthly')),
  CONSTRAINT chk_members_salary       CHECK (salary_amount > 0),
  CONSTRAINT chk_members_left_at      CHECK (left_at IS NULL OR left_at >= joined_at)
);
```

**インデックス:**
| インデックス名 | 対象カラム | 種別 | 用途 |
|---|---|---|---|
| idx_members_status | status | B-tree | M1-01フィルター |
| idx_members_company | company | B-tree | M6フィルター |
| idx_members_deleted_at | deleted_at | B-tree | 論理削除絞り込み |

> **注意:** `bank_name`, `bank_branch`, `bank_account_number`, `bank_account_holder` はアプリケーション層でAES-256暗号化してから保存する。

---

### 3-3. skill_categories（スキルカテゴリ）

```sql
CREATE TABLE skill_categories (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(50)   NOT NULL,
  description    VARCHAR(200),
  display_order  INTEGER       NOT NULL    DEFAULT 1,
  created_at     TIMESTAMPTZ   NOT NULL    DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL    DEFAULT NOW(),

  CONSTRAINT uq_skill_categories_name          UNIQUE (name),
  CONSTRAINT chk_skill_categories_order        CHECK (display_order >= 1)
);
```

**インデックス:**
| インデックス名 | 対象カラム | 種別 | 用途 |
|---|---|---|---|
| idx_skill_categories_order | display_order | B-tree | 表示順ソート |

---

### 3-4. skills（スキル）

```sql
CREATE TABLE skills (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id    UUID          NOT NULL    REFERENCES skill_categories(id),
  name           VARCHAR(100)  NOT NULL,
  description    VARCHAR(200),
  display_order  INTEGER       NOT NULL    DEFAULT 1,
  created_at     TIMESTAMPTZ   NOT NULL    DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL    DEFAULT NOW(),

  CONSTRAINT uq_skills_name_in_category  UNIQUE (category_id, name),
  CONSTRAINT chk_skills_order            CHECK (display_order >= 1)
);
```

**インデックス:**
| インデックス名 | 対象カラム | 種別 | 用途 |
|---|---|---|---|
| idx_skills_category_id | category_id | B-tree | カテゴリJOIN |
| idx_skills_order | (category_id, display_order) | B-tree | 表示順ソート |

---

### 3-5. member_skills（メンバースキル評価）

> 評価は追記型。最新評価 = `evaluated_at` が最大のレコード。上書き更新しない。

```sql
CREATE TABLE member_skills (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id      UUID          NOT NULL    REFERENCES members(id),
  skill_id       UUID          NOT NULL    REFERENCES skills(id),
  level          SMALLINT      NOT NULL,
  evaluated_at   DATE          NOT NULL,
  memo           VARCHAR(500),
  evaluated_by   UUID          NOT NULL    REFERENCES user_accounts(id),
  created_at     TIMESTAMPTZ   NOT NULL    DEFAULT NOW(),

  CONSTRAINT chk_member_skills_level  CHECK (level BETWEEN 1 AND 5)
);
```

**インデックス:**
| インデックス名 | 対象カラム | 種別 | 用途 |
|---|---|---|---|
| idx_member_skills_member_skill | (member_id, skill_id, evaluated_at DESC) | B-tree | 最新評価取得 |
| idx_member_skills_skill_id | skill_id | B-tree | スキルマトリクス表示 |

---

### 3-6. projects（プロジェクト）

```sql
CREATE TABLE projects (
  id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     VARCHAR(200)  NOT NULL,
  description              TEXT,
  status                   VARCHAR(20)   NOT NULL,   -- 'planning'|'active'|'completed'|'on_hold'
  company                  VARCHAR(10)   NOT NULL,   -- 'boost' | 'salt2'
  start_date               DATE          NOT NULL,
  end_date                 DATE,
  client_name              VARCHAR(200),
  project_type             VARCHAR(20)   NOT NULL    DEFAULT 'salt2_own', -- 'boost_dispatch' | 'salt2_own'
  contract_type            VARCHAR(20),              -- 'quasi_mandate'|'contract'|'in_house'|'other'
  monthly_contract_amount  INTEGER       DEFAULT 0,
  created_by               UUID          NOT NULL    REFERENCES user_accounts(id),
  deleted_at               TIMESTAMPTZ,              -- 論理削除
  created_at               TIMESTAMPTZ   NOT NULL    DEFAULT NOW(),
  updated_at               TIMESTAMPTZ   NOT NULL    DEFAULT NOW(),

  CONSTRAINT chk_projects_status         CHECK (status IN ('planning','active','completed','on_hold')),
  CONSTRAINT chk_projects_type           CHECK (project_type IN ('boost_dispatch','salt2_own')),
  CONSTRAINT chk_projects_company        CHECK (company IN ('boost','salt2')),
  CONSTRAINT chk_projects_contract_type  CHECK (contract_type IN ('quasi_mandate','contract','in_house','other') OR contract_type IS NULL),
  CONSTRAINT chk_projects_amount         CHECK (monthly_contract_amount >= 0),
  CONSTRAINT chk_projects_dates          CHECK (end_date IS NULL OR end_date >= start_date)
);
```

**インデックス:**
| インデックス名 | 対象カラム | 種別 | 用途 |
|---|---|---|---|
| idx_projects_status | status | B-tree | M3-01フィルター |
| idx_projects_company | company | B-tree | M6フィルター |
| idx_projects_deleted_at | deleted_at | B-tree | 論理削除絞り込み |

---

### 3-7. project_positions（PJポジション）

```sql
CREATE TABLE project_positions (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID          NOT NULL    REFERENCES projects(id),
  position_name   VARCHAR(100)  NOT NULL,
  required_count  SMALLINT      NOT NULL    DEFAULT 1,
  created_at      TIMESTAMPTZ   NOT NULL    DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL    DEFAULT NOW(),

  CONSTRAINT chk_project_positions_count  CHECK (required_count >= 1)
);
```

**インデックス:**
| インデックス名 | 対象カラム | 種別 | 用途 |
|---|---|---|---|
| idx_project_positions_project_id | project_id | B-tree | PJごとポジション一覧 |

---

### 3-8. position_required_skills（ポジション必要スキル）

```sql
CREATE TABLE position_required_skills (
  id           UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id  UUID      NOT NULL    REFERENCES project_positions(id),
  skill_id     UUID      NOT NULL    REFERENCES skills(id),
  min_level    SMALLINT  NOT NULL,

  CONSTRAINT uq_position_required_skills  UNIQUE (position_id, skill_id),
  CONSTRAINT chk_position_req_level       CHECK (min_level BETWEEN 1 AND 5)
);
```

**インデックス:**
| インデックス名 | 対象カラム | 種別 | 用途 |
|---|---|---|---|
| idx_position_req_skills_pos | position_id | B-tree | ポジションスキル一覧 |

---

### 3-9. project_assignments（アサイン）

```sql
CREATE TABLE project_assignments (
  id              UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID     NOT NULL    REFERENCES projects(id),
  position_id     UUID     NOT NULL    REFERENCES project_positions(id),
  member_id       UUID     NOT NULL    REFERENCES members(id),
  workload_hours  INTEGER  NOT NULL,
  start_date      DATE     NOT NULL,
  end_date        DATE,                -- NULL = 継続中
  created_by      UUID     NOT NULL    REFERENCES user_accounts(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_project_assignments_hours  CHECK (workload_hours >= 1),
  CONSTRAINT chk_project_assignments_dates  CHECK (end_date IS NULL OR end_date >= start_date)
);
```

**インデックス:**
| インデックス名 | 対象カラム | 種別 | 用途 |
|---|---|---|---|
| idx_project_assignments_project | project_id | B-tree | M3-05工数集計 |
| idx_project_assignments_member | member_id | B-tree | M6-01人件費按分 |
| idx_project_assignments_period | (member_id, start_date, end_date) | B-tree | 工数重複チェック |

---

### 3-10. work_schedules（勤務予定）

```sql
CREATE TABLE work_schedules (
  id          UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   UUID     NOT NULL    REFERENCES members(id),
  date        DATE     NOT NULL,
  start_time  TIME,
  end_time    TIME,
  is_off      BOOLEAN  NOT NULL    DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_work_schedules_member_date  UNIQUE (member_id, date),
  CONSTRAINT chk_work_schedules_time        CHECK (is_off OR end_time IS NULL OR end_time >= start_time)
);
```

**インデックス:**
| インデックス名 | 対象カラム | 種別 | 用途 |
|---|---|---|---|
| idx_work_schedules_member_date | (member_id, date) | UNIQUE | スケジュール取得 |
| idx_work_schedules_date | date | B-tree | C-02カレンダー |

---

### 3-11. attendances（勤怠）

```sql
CREATE TABLE attendances (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id        UUID          NOT NULL    REFERENCES members(id),
  date             DATE          NOT NULL,
  clock_in         TIMESTAMPTZ,
  clock_out        TIMESTAMPTZ,
  break_minutes    INTEGER       DEFAULT 0,
  work_minutes     INTEGER,                  -- 自動計算: (clock_out - clock_in) - break_minutes
  todo_today       VARCHAR(500),
  done_today       VARCHAR(500),
  todo_tomorrow    VARCHAR(500),
  status           VARCHAR(20)   NOT NULL    DEFAULT 'normal', -- 'normal'|'modified'|'absent'
  confirm_status   VARCHAR(20)   NOT NULL    DEFAULT 'unconfirmed', -- 'unconfirmed'|'confirmed'|'approved'
  slack_notified   BOOLEAN       NOT NULL    DEFAULT false,
  created_at       TIMESTAMPTZ   NOT NULL    DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL    DEFAULT NOW(),

  CONSTRAINT uq_attendances_member_date     UNIQUE (member_id, date),
  CONSTRAINT chk_attendances_clock         CHECK (clock_out IS NULL OR clock_out >= clock_in),
  CONSTRAINT chk_attendances_break         CHECK (break_minutes >= 0),
  CONSTRAINT chk_attendances_status        CHECK (status IN ('normal','modified','absent')),
  CONSTRAINT chk_attendances_confirm       CHECK (confirm_status IN ('unconfirmed','confirmed','approved'))
);
```

**インデックス:**
| インデックス名 | 対象カラム | 種別 | 用途 |
|---|---|---|---|
| idx_attendances_member_date | (member_id, date) | UNIQUE | 日次勤怠取得 |
| idx_attendances_confirm | confirm_status | B-tree | M5-01承認フロー |
| idx_attendances_month | (member_id, date) | B-tree | 月次集計 |

---

### 3-12. invoices（請求書）

```sql
CREATE TABLE invoices (
  id                 UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number     VARCHAR(20)    NOT NULL,
  member_id          UUID           NOT NULL    REFERENCES members(id),
  target_month       CHAR(7)        NOT NULL,   -- 'YYYY-MM'
  work_hours_total   NUMERIC(6,2)   NOT NULL    DEFAULT 0,
  unit_price         INTEGER        NOT NULL,
  amount_excl_tax    INTEGER        NOT NULL    DEFAULT 0,
  amount_incl_tax    INTEGER        NOT NULL    DEFAULT 0,
  -- 会社別按分請求額（個人の会社別稼働配分に基づく）
  amount_boost       INTEGER        NOT NULL    DEFAULT 0,  -- Boost向け請求額（税抜）
  amount_salt2       INTEGER        NOT NULL    DEFAULT 0,  -- SALT2向け請求額（税抜）
  file_path          TEXT,
  slack_sent_status  VARCHAR(10)    NOT NULL    DEFAULT 'unsent', -- 'unsent'|'sent'
  issued_at          DATE           NOT NULL,
  created_at         TIMESTAMPTZ    NOT NULL    DEFAULT NOW(),
  updated_at         TIMESTAMPTZ    NOT NULL    DEFAULT NOW(),

  CONSTRAINT uq_invoices_number             UNIQUE (invoice_number),
  CONSTRAINT uq_invoices_member_month       UNIQUE (member_id, target_month),
  CONSTRAINT chk_invoices_hours             CHECK (work_hours_total >= 0),
  CONSTRAINT chk_invoices_amount            CHECK (amount_excl_tax >= 0 AND amount_incl_tax >= 0),
  CONSTRAINT chk_invoices_boost_salt2       CHECK (amount_boost >= 0 AND amount_salt2 >= 0),
  CONSTRAINT chk_invoices_boost_salt2_sum   CHECK (amount_boost + amount_salt2 = amount_excl_tax),
  CONSTRAINT chk_invoices_slack_sent_status CHECK (slack_sent_status IN ('unsent','sent'))
);
```

**インデックス:**
| インデックス名 | 対象カラム | 種別 | 用途 |
|---|---|---|---|
| idx_invoices_member_month | (member_id, target_month) | UNIQUE | 月次請求取得 |
| idx_invoices_target_month | target_month | B-tree | M5-02フィルター |

---

### 3-13. pl_records（PL / CFレコード）

> `record_type = 'pl'` のときは `project_id` 必須。`record_type = 'cf'` のときは `project_id = NULL`。

```sql
CREATE TABLE pl_records (
  id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  record_type              VARCHAR(5)    NOT NULL,   -- 'pl' | 'cf'
  project_id               UUID          REFERENCES projects(id),  -- cf時はNULL
  target_month             CHAR(7)       NOT NULL,   -- 'YYYY-MM'
  -- PL項目
  revenue_contract         INTEGER       DEFAULT 0,
  revenue_extra            INTEGER       DEFAULT 0,
  cost_labor_monthly       INTEGER       DEFAULT 0,
  cost_labor_hourly        INTEGER       DEFAULT 0,
  cost_outsourcing         INTEGER       DEFAULT 0,
  cost_tools               INTEGER       DEFAULT 0,  -- ツール費用（member_toolsから按分）
  cost_other               INTEGER       DEFAULT 0,
  gross_profit             INTEGER       DEFAULT 0,
  gross_profit_rate        NUMERIC(5,2),
  markup_rate              NUMERIC(5,3),             -- boost_dispatch時の掛け率（例: 1.200）
  -- CF項目 (record_type='cf' のみ有効)
  cf_cash_in_client        INTEGER       DEFAULT 0,
  cf_cash_in_other         INTEGER       DEFAULT 0,
  cf_cash_out_salary       INTEGER       DEFAULT 0,
  cf_cash_out_outsourcing  INTEGER       DEFAULT 0,
  cf_cash_out_fixed        INTEGER       DEFAULT 0,
  cf_cash_out_other        INTEGER       DEFAULT 0,
  cf_balance_prev          INTEGER,
  cf_balance_current       INTEGER       DEFAULT 0,
  memo                     VARCHAR(200),
  created_by               UUID          NOT NULL    REFERENCES user_accounts(id),
  created_at               TIMESTAMPTZ   NOT NULL    DEFAULT NOW(),
  updated_at               TIMESTAMPTZ   NOT NULL    DEFAULT NOW(),

  CONSTRAINT uq_pl_records_key           UNIQUE (project_id, target_month, record_type),
  CONSTRAINT chk_pl_records_type         CHECK (record_type IN ('pl','cf')),
  CONSTRAINT chk_pl_records_pl_project   CHECK (record_type <> 'pl' OR project_id IS NOT NULL),
  CONSTRAINT chk_pl_records_cf_project   CHECK (record_type <> 'cf' OR project_id IS NULL)
);
```

**インデックス:**
| インデックス名 | 対象カラム | 種別 | 用途 |
|---|---|---|---|
| idx_pl_records_project_month | (project_id, target_month) | B-tree | M6-01 PJ別PL |
| idx_pl_records_month_type | (target_month, record_type) | B-tree | M6-02/03集計 |

---

### 3-14. member_tools（メンバー利用ツール）

```sql
CREATE TABLE member_tools (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id      UUID          NOT NULL    REFERENCES members(id),
  tool_name      VARCHAR(100)  NOT NULL,
  plan           VARCHAR(50),
  monthly_cost   INTEGER       NOT NULL    DEFAULT 0,
  company_label  VARCHAR(10)   NOT NULL,   -- 'boost' | 'salt2'
  note           VARCHAR(200),
  created_at     TIMESTAMPTZ   NOT NULL    DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL    DEFAULT NOW(),

  CONSTRAINT chk_member_tools_cost     CHECK (monthly_cost >= 0),
  CONSTRAINT chk_member_tools_company  CHECK (company_label IN ('boost','salt2'))
);
```

**インデックス:**
| インデックス名 | 対象カラム | 種別 | 用途 |
|---|---|---|---|
| idx_member_tools_member_id | member_id | B-tree | M1-02表示・M6コスト |
| idx_member_tools_company | company_label | B-tree | M6会社別集計 |

---

### 3-15. member_contracts（メンバー契約書）

```sql
CREATE TABLE member_contracts (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       UUID          NOT NULL    REFERENCES members(id),
  status          VARCHAR(20)   NOT NULL    DEFAULT 'draft', -- 'draft'|'sent'|'waiting_sign'|'completed'|'voided'
  template_name   VARCHAR(100)  NOT NULL,
  start_date      DATE,
  end_date        DATE,
  file_url        TEXT,                    -- S3等への保存パス
  file_hash       VARCHAR(128),            -- SHA256改ざん検知
  signer_email    VARCHAR(255)  NOT NULL,  -- PII
  sent_at         TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL   DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL   DEFAULT NOW(),

  CONSTRAINT chk_member_contracts_status  CHECK (status IN ('draft','sent','waiting_sign','completed','voided')),
  CONSTRAINT chk_member_contracts_dates   CHECK (end_date IS NULL OR end_date >= start_date)
);
```

**インデックス:**
| インデックス名 | 対象カラム | 種別 | 用途 |
|---|---|---|---|
| idx_member_contracts_member | member_id | B-tree | M1-02契約一覧 |
| idx_member_contracts_status | status | B-tree | ステータスフィルター |

---

### 3-16. audit_logs（監査ログ）

> 削除・更新不可（INSERT専用）。アプリケーション層でも行レベルセキュリティ(RLS)または権限制御で保護。

```sql
CREATE TABLE audit_logs (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id    UUID          NOT NULL    REFERENCES user_accounts(id),
  target_table   VARCHAR(100)  NOT NULL,
  target_id      UUID          NOT NULL,
  action         VARCHAR(10)   NOT NULL,   -- 'CREATE'|'UPDATE'|'DELETE'
  before_data    JSONB,                    -- CREATE時はNULL
  after_data     JSONB,                    -- DELETE時はNULL
  ip_address     VARCHAR(45)   NOT NULL,
  created_at     TIMESTAMPTZ   NOT NULL    DEFAULT NOW(),

  CONSTRAINT chk_audit_logs_action  CHECK (action IN ('CREATE','UPDATE','DELETE'))
);
```

**インデックス:**
| インデックス名 | 対象カラム | 種別 | 用途 |
|---|---|---|---|
| idx_audit_logs_operator | operator_id | B-tree | 操作者検索 |
| idx_audit_logs_target | (target_table, target_id) | B-tree | レコード別履歴 |
| idx_audit_logs_created_at | created_at | B-tree | 時系列検索 |

---

### 3-17. system_configs（システム設定）

> キーバリュー形式のシステム設定テーブル。Slack Webhook URL、通知設定等を管理する。シークレット値は `is_secret = true` でマスク表示。

```sql
CREATE TABLE system_configs (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  key          VARCHAR(100)  NOT NULL,
  value        TEXT          NOT NULL,
  is_secret    BOOLEAN       NOT NULL    DEFAULT false,
  updated_by   UUID          NOT NULL    REFERENCES user_accounts(id),
  updated_at   TIMESTAMPTZ   NOT NULL    DEFAULT NOW(),

  CONSTRAINT uq_system_configs_key  UNIQUE (key)
);
```

**主要キー（確定）:**
| キー | 内容 | シークレット |
|------|------|------------|
| `slack_webhook_url` | Slack Incoming Webhook URL | ○ |
| `slack_attendance_channel` | 勤怠通知チャンネル名 | — |
| `monthly_closing_notify_day` | 月次締め通知日（1〜28） | — |
| `company_name_boost` | Boost社の表示名 | — |
| `company_name_salt2` | SALT2社の表示名 | — |

**インデックス:**
| インデックス名 | 対象カラム | 種別 | 用途 |
|---|---|---|---|
| uq_system_configs_key | key | UNIQUE | キー検索 |

---

## 4. 正規化方針

| 方針 | 内容 |
|------|------|
| 正規化レベル | 第3正規形（3NF）を基本とする |
| マスタと明細の分離 | `skill_categories` / `skills` を独立テーブルとし、評価・要件テーブルからFK参照 |
| 繰り返し項目の排除 | ツール・契約書は別テーブル（`member_tools` / `member_contracts`）として1:N保持 |
| 導出項目の扱い | `work_minutes`（勤怠）、`gross_profit` / `gross_profit_rate`（PL）はDBにも保存（集計コスト削減）。更新トリガーまたはアプリ層で同期 |
| ENUM vs 参照テーブル | 変更頻度が低い区分（`role`, `status`, `company` 等）はCHECK制約で管理し、別テーブルは作成しない |

---

## 5. 監査カラム方針

| カラム | 対象 | 型 | デフォルト | 備考 |
|--------|------|-----|-----------|------|
| `created_at` | 全テーブル | TIMESTAMPTZ | `NOW()` | INSERT時に自動設定 |
| `updated_at` | 全テーブル（audit_logsを除く） | TIMESTAMPTZ | `NOW()` | UPDATE時にアプリ層またはトリガーで更新 |
| `created_by` | `projects` / `project_assignments` / `pl_records` | UUID → `user_accounts` | — | 変更操作者の記録 |
| `deleted_at` | `members` / `projects` | TIMESTAMPTZ | NULL | 論理削除（後述） |

`updated_at` は以下のトリガーで自動更新（Prisma使用時は `@updatedAt` で代替）:

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 6. 論理削除方針

| テーブル | 論理削除 | 理由 |
|---------|---------|------|
| `members` | ○（`deleted_at`） | 退社後も勤怠・請求履歴を参照するため |
| `projects` | ○（`deleted_at`） | 完了・保留PJのPL・アサイン履歴を保持するため |
| `skills` / `skill_categories` | △ 要検討 | スキルマトリクスに影響するため、`display_order` で非表示管理でも可 |
| その他トランザクションテーブル | × 物理削除 | 監査ログで変更履歴を追うため |
| `audit_logs` | × 削除禁止 | 監査目的のためINSERT専用 |

**クエリ規則:** `deleted_at IS NULL` をデフォルト条件として付与。Prismaの `softDelete` ミドルウェアまたは RLS で自動適用する。

---

## 7. セキュリティ・アクセス制御

| 項目 | 方針 |
|------|------|
| 銀行口座情報 | `bank_name` / `bank_branch` / `bank_account_number` / `bank_account_holder` はアプリケーション層でAES-256暗号化してから保存 |
| 給与情報 | `salary_amount` / `unit_price` はRLSまたはAPIレイヤーで `admin` / `manager` のみ参照可 |
| 契約書ファイル | `file_url` / `signer_email` は本人と管理者のみ取得可能 |
| 監査ログ | INSERT専用。アプリケーションサービスアカウントに `UPDATE` / `DELETE` 権限を付与しない |
| PII（個人情報） | `members.name` / `phone` / `address` のAPIレスポンスにはロールチェックを必須化 |

---

### 3-18. attendance_allocations（勤怠プロジェクト配分）

```sql
CREATE TABLE attendance_allocations (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id  UUID        NOT NULL    REFERENCES attendances(id) ON DELETE CASCADE,
  project_id     UUID        NOT NULL    REFERENCES projects(id),
  minutes        INTEGER     NOT NULL,   -- 実働配分（分）。百分率で受け取り時はサーバーで分に換算
  created_at     TIMESTAMPTZ NOT NULL    DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL    DEFAULT NOW(),

  CONSTRAINT chk_att_alloc_minutes CHECK (minutes >= 0),
  CONSTRAINT uq_att_alloc UNIQUE (attendance_id, project_id)
);
```

**用途:** 退勤時に自己申告で入力。合計が `attendances.work_minutes` と一致するようアプリ側で検証。

**インデックス:**
| インデックス名 | 対象カラム | 種別 | 用途 |
|---|---|---|---|
| uq_att_alloc | (attendance_id, project_id) | UNIQUE | 同一勤怠で同一PJを二重登録しない |
| idx_att_alloc_attendance | attendance_id | B-tree | 勤怠→配分の取得 |
| idx_att_alloc_project | project_id | B-tree | PJ別配分集計 |

### 3-19. intra_company_settlements（社内精算）


```sql
CREATE TABLE intra_company_settlements (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  target_month       DATE        NOT NULL,          -- YYYY-MM-01で管理
  paying_company     VARCHAR(10) NOT NULL,          -- 'boost' | 'salt2'
  receiving_company  VARCHAR(10) NOT NULL,          -- 'boost' | 'salt2'
  member_id          UUID,                          -- 任意。個別明細を残す場合
  amount             INTEGER     NOT NULL,          -- 円。支払元→受取側の社内請求額
  basis              VARCHAR(20) NOT NULL DEFAULT 'allocation', -- 'allocation' | 'manual'
  note               VARCHAR(200),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_intra_company CHECK (paying_company IN ('boost','salt2') AND receiving_company IN ('boost','salt2') AND paying_company <> receiving_company),
  CONSTRAINT chk_intra_amount CHECK (amount >= 0)
);
```

**用途:** 月次締め時に給与按分から自動計算し、PL表示時は内部取引として相殺可能なフラグを付与（PLレポート側で扱う）。

**インデックス:**
| インデックス名 | 対象カラム | 種別 | 用途 |
|---|---|---|---|
| idx_intra_month | target_month | B-tree | 月次サマリー取得 |
| idx_intra_direction | (paying_company, receiving_company, target_month) | B-tree | 方向別集計 |
| idx_intra_member | member_id | B-tree | 個別明細追跡 |

---

### 3-20. monthly_self_reports（月次自己申告）

> メンバーが月次で各プロジェクトへの実働時間を自己申告するテーブル。退勤時の `attendance_allocations`（日次）とは別に、月次締め時点の確定値として保持する。

```sql
CREATE TABLE monthly_self_reports (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id        UUID         NOT NULL    REFERENCES members(id),
  target_month     CHAR(7)      NOT NULL,   -- 'YYYY-MM'
  project_id       UUID         NOT NULL    REFERENCES projects(id),
  reported_hours   NUMERIC(6,2) NOT NULL,   -- 申告工数（時間）
  note             VARCHAR(500),
  submitted_at     TIMESTAMPTZ,             -- NULL = 下書き
  created_at       TIMESTAMPTZ  NOT NULL    DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL    DEFAULT NOW(),

  CONSTRAINT uq_monthly_self_reports_key   UNIQUE (member_id, target_month, project_id),
  CONSTRAINT chk_monthly_reports_hours     CHECK (reported_hours >= 0)
);
```

**インデックス:**
| インデックス名 | 対象カラム | 種別 | 用途 |
|---|---|---|---|
| uq_monthly_self_reports_key | (member_id, target_month, project_id) | UNIQUE | 月次重複防止 |
| idx_monthly_reports_member_month | (member_id, target_month) | B-tree | マイページ表示 |
| idx_monthly_reports_project_month | (project_id, target_month) | B-tree | M3-05工数集計 |

---

## 8. RLS / 権限方針（抜粋）

- 共通: `audit_logs` はアプリサービスアカウントのみ INSERT 権限。UPDATE/DELETE 不可。
- `members` の PII カラム（住所・電話・銀行情報）はアプリ層で暗号化＋ロールチェック。RLS を導入する場合は `role IN ('admin') OR user_account.member_id = members.id` を許可。
- `member_contracts`（契約書）: RLS で本人+管理者のみ SELECT を許可。file_url は署名付きURL発行で返す。
- `attendance_allocations`: 本人と管理者/担当マネージャーが SELECT/INSERT/UPDATE 可能。DELETE は管理者のみ。
- `intra_company_settlements`: admin のみ SELECT/INSERT/UPDATE。社内精算は集計結果のため本人には非公開。

## 10. Prisma スキーマ対応メモ

| DB設計 | Prismaでの扱い |
|--------|---------------|
| `UUID` PK | `@id @default(dbgenerated("gen_random_uuid()")) @db.Uuid` |
| `TIMESTAMPTZ` | `@db.Timestamptz` |
| `updated_at` 自動更新 | `@updatedAt` |
| ENUM | Prisma `enum` 定義 または `String` + バリデーション |
| 論理削除 (`deleted_at`) | Prisma middleware または `prisma-soft-delete-middleware` |
| 監査ログ | Prisma middleware で全書き込み前後をキャプチャ |

---

## 11. インデックス設計まとめ

主要な複合インデックス・ユニーク制約一覧:

| テーブル | インデックス | 目的 |
|---------|------------|------|
| user_accounts | UNIQUE(email) | ログイン照合 |
| user_accounts | UNIQUE(oauth_provider, oauth_provider_id) | OAuth照合 |
| work_schedules | UNIQUE(member_id, date) | 1日1レコード保証 |
| attendances | UNIQUE(member_id, date) | 1日1レコード保証 |
| invoices | UNIQUE(member_id, target_month) | 月次1請求保証 |
| member_skills | (member_id, skill_id, evaluated_at DESC) | 最新評価高速取得 |
| pl_records | UNIQUE(project_id, target_month, record_type) | PL/CF重複防止 |
| monthly_self_reports | UNIQUE(member_id, target_month, project_id) | 月次自己申告重複防止 |
| personnel_evaluations | UNIQUE(member_id, target_period) | 1メンバー×1月=1評価 |

---

## 21. personnel_evaluations（人事評価 PAS）

### 目的
メンバーに対する月次人事考課（PAS評価）を管理する。
スキルマトリクス（M2: 個別技術スキル）とは独立した、高レベルの人事評価テーブル。

### テーブル定義

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | UUID | PK, default=gen_random_uuid() | 評価ID |
| member_id | UUID | FK → members(id), NOT NULL | 被評価メンバー |
| evaluator_id | UUID | FK → user_accounts(id), NOT NULL | 評価者（管理者の UserAccount.id） |
| target_period | CHAR(7) | NOT NULL | 対象月 'YYYY-MM' |
| score_p | INTEGER | NOT NULL, CHECK(1-5) | Professional スコア |
| score_a | INTEGER | NOT NULL, CHECK(1-5) | Appearance スコア |
| score_s | INTEGER | NOT NULL, CHECK(1-5) | Skill スコア |
| comment | TEXT | nullable | 評価コメント（最大1000文字） |
| created_at | TIMESTAMP | NOT NULL, default=now() | 作成日時 |
| updated_at | TIMESTAMP | NOT NULL, on update=now() | 更新日時 |

### インデックス
| インデックス | 目的 |
|------------|------|
| UNIQUE(member_id, target_period) | 1メンバー×1月=1評価 (upsert基準) |
| INDEX(member_id, target_period DESC) | メンバー別履歴取得 |

### スコア定義

| 値 | ラベル |
|----|--------|
| 1 | 要改善 |
| 2 | 普通以下 |
| 3 | 標準 |
| 4 | 優秀 |
| 5 | 卓越 |

### ER リレーション
```
MEMBERS ──── 1:N ──── PERSONNEL_EVALUATIONS
USER_ACCOUNTS ──── 1:N ──── PERSONNEL_EVALUATIONS (evaluator_id)
```

### 特記事項
- 1メンバー × 1ヶ月 = 1レコード（UNIQUE制約）。既存月の再評価は UPDATE（upsert）
- evaluator_id は必ず admin ロールの UserAccount.id であること（API側でチェック）
- score_p / score_a / score_s の合計平均を「総合スコア」として API が算出して返却（DB保存は不要）
- PII 非対象（氏名等は含まない）

---

> 次は `/design-requirements-v2` で要件定義 v2（API・画面要件の詳細化）を作成してください。
