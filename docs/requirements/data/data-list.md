# データ項目一覧（データ辞書）

> 作成日: 2026-02-18
> 参照元: docs/requirements/ipo/ipo.md / docs/requirements/specifications/*.md

---

## エンティティ一覧

| # | エンティティ（物理名） | 論理名 | 概要 |
|---|----------------------|--------|------|
| 1 | USER_ACCOUNT | ユーザーアカウント | 認証・ロール管理 |
| 2 | MEMBER | メンバー | 人事基本情報 |
| 3 | SKILL_CATEGORY | スキルカテゴリ | スキル分類マスタ |
| 4 | SKILL | スキル | スキル項目マスタ |
| 5 | MEMBER_SKILL | メンバースキル評価 | 評価履歴（追記型） |
| 6 | PROJECT | プロジェクト | PJ 基本情報 |
| 7 | PROJECT_POSITION | PJポジション | PJ 内ポジション定義 |
| 8 | POSITION_REQUIRED_SKILL | ポジション必要スキル | ポジション × スキル要件 |
| 9 | PROJECT_ASSIGNMENT | アサイン | メンバー × PJ 工数割当 |
| 10 | WORK_SCHEDULE | 勤務予定 | 週次勤務予定 |
| 11 | ATTENDANCE | 勤怠 | 日次出退勤・日報 |
| 12 | INVOICE | 請求書 | 月次請求書 |
| 13 | PL_RECORD | PL / CF レコード | 損益・キャッシュフロー |
| 14 | AUDIT_LOG | 監査ログ | 全書き込み操作の変更前後 |

---

## 1. USER_ACCOUNT（ユーザーアカウント）

| 論理名 | 物理名 | 型 | 必須 | 制約 | 例 | 出所 | 利用先 | PII | 備考 |
|--------|--------|-----|------|------|----|------|--------|-----|------|
| アカウントID | id | UUID | ○ | PK | `uuid-xxxx` | システム | 全テーブル（FK） | — | |
| メールアドレス | email | VARCHAR(255) | ○ | UNIQUE / メール形式 | `yamada@example.com` | OAuth プロバイダー | ログイン照合 | ○ | |
| OAuthプロバイダー種別 | oauth_provider | ENUM | ○ | `slack` / `google` | `slack` | C-01 | 認証フロー | — | |
| OAuthプロバイダーID | oauth_provider_id | VARCHAR(255) | ○ | プロバイダー内UNIQUE | `U012AB3CD` | OAuth コールバック | 認証照合 | — | |
| ロール | role | ENUM | ○ | `admin` / `manager` / `employee` / `intern` | `intern` | M1-03 | 権限制御（全画面） | — | |
| メンバーID | member_id | UUID | ○ | FK → MEMBER.id | — | M1-03 | セッション生成 | — | |
| 作成日時 | created_at | TIMESTAMPTZ | ○ | DEFAULT NOW() | `2026-04-01T09:00:00Z` | システム | — | — | |
| 更新日時 | updated_at | TIMESTAMPTZ | ○ | ON UPDATE NOW() | — | システム | — | — | |

---

## 2. MEMBER（メンバー）

| 論理名 | 物理名 | 型 | 必須 | 制約 | 例 | 出所 | 利用先 | PII | 備考 |
|--------|--------|-----|------|------|----|------|--------|-----|------|
| メンバーID | id | UUID | ○ | PK | `uuid-xxxx` | システム | 全テーブル（FK） | — | |
| 氏名 | name | VARCHAR(100) | ○ | — | `山田 さくら` | M1-03 | M1-01/02, M4-03, M5-01 | ○ | |
| プロフィール画像URL | profile_image_url | TEXT | — | JPEG/PNG・5MB以内 | `https://...` | M1-03 | M1-01, M2-01 | △ | 未設定時はデフォルトアバター |
| 電話番号 | phone | VARCHAR(20) | — | 数字・ハイフン | `090-1234-5678` | M1-03 | M1-02 | ○ | |
| 住所 | address | TEXT | 条件付 | 時給制メンバーは必須 | `東京都渋谷区...` | M1-03 | M1-02 | ○ | |
| ステータス | status | ENUM | ○ | `executive` / `employee` / `intern_full` / `intern_training` / `training_member` | `intern_training` | M1-03 | M1-01 フィルター | — | 役員/社員/本採用インターン/研修インターン/研修メンバー |
| 所属会社 | company | ENUM | ○ | `boost` / `salt2` | `salt2` | M1-03 | M1-01, M3, M6 | — | |
| 報酬形態 | salary_type | ENUM | ○ | `hourly` / `monthly` | `hourly` | M1-03 | M5-01, M6-01 | — | 時給制 / 月額固定 |
| 報酬金額 | salary_amount | INTEGER | ○ | 正の整数 | `1500` | M1-03 | M5-01, M6-01 人件費計算 | ○ | 時給または月額（円） |
| 銀行名 | bank_name | TEXT | 条件付 | 時給制必須・AES-256暗号化 | `三菱UFJ銀行` | M1-03 | M5-02 請求書 | ○ | 暗号化保存 |
| 支店名 | bank_branch | TEXT | 条件付 | 時給制必須・AES-256暗号化 | `渋谷支店` | M1-03 | M5-02 請求書 | ○ | 暗号化保存 |
| 口座番号 | bank_account_number | TEXT | 条件付 | 時給制必須・数字7桁・AES-256暗号化 | `1234567` | M1-03 | M5-02 請求書 | ○ | 暗号化保存 |
| 口座名義 | bank_account_holder | TEXT | 条件付 | 時給制必須・AES-256暗号化 | `ヤマダ サクラ` | M1-03 | M5-02 請求書 | ○ | 暗号化保存 |
| 入社日 | joined_at | DATE | ○ | YYYY-MM-DD | `2026-04-01` | M1-03 | M1-02 | — | |
| 退社日 | left_at | DATE | — | joined_at 以降 | `2027-03-31` | M1-03 | M1-02 | — | NULL = 在籍中 |
| 作成日時 | created_at | TIMESTAMPTZ | ○ | DEFAULT NOW() | — | システム | — | — | |
| 更新日時 | updated_at | TIMESTAMPTZ | ○ | ON UPDATE NOW() | — | システム | — | — | |

---

## 3. SKILL_CATEGORY（スキルカテゴリ）

| 論理名 | 物理名 | 型 | 必須 | 制約 | 例 | 出所 | 利用先 | PII | 備考 |
|--------|--------|-----|------|------|----|------|--------|-----|------|
| カテゴリID | id | UUID | ○ | PK | `uuid-xxxx` | システム | SKILL.category_id | — | |
| カテゴリ名 | name | VARCHAR(50) | ○ | UNIQUE | `エンジニアリング` | M2-02 | M2-01 フィルター | — | |
| 説明 | description | VARCHAR(200) | — | — | — | M2-02 | M2-02 管理画面 | — | |
| 表示順 | display_order | INTEGER | ○ | 1以上 | `1` | M2-02 | M2-01 列順 | — | ドラッグ&ドロップで変更 |
| 作成日時 | created_at | TIMESTAMPTZ | ○ | DEFAULT NOW() | — | システム | — | — | |
| 更新日時 | updated_at | TIMESTAMPTZ | ○ | ON UPDATE NOW() | — | システム | — | — | |

---

## 4. SKILL（スキル）

| 論理名 | 物理名 | 型 | 必須 | 制約 | 例 | 出所 | 利用先 | PII | 備考 |
|--------|--------|-----|------|------|----|------|--------|-----|------|
| スキルID | id | UUID | ○ | PK | `uuid-xxxx` | システム | MEMBER_SKILL, POSITION_REQUIRED_SKILL | — | |
| カテゴリID | category_id | UUID | ○ | FK → SKILL_CATEGORY.id | — | M2-02 | M2-01 列グループ | — | |
| スキル名 | name | VARCHAR(100) | ○ | カテゴリ内UNIQUE | `フロントエンド` | M2-02 | M2-01 列ヘッダー | — | |
| 説明 | description | VARCHAR(200) | — | — | `React, Vue.js等` | M2-02 | M2-02 管理画面 | — | |
| 表示順 | display_order | INTEGER | ○ | 1以上 | `1` | M2-02 | M2-01 列順 | — | |
| 作成日時 | created_at | TIMESTAMPTZ | ○ | DEFAULT NOW() | — | システム | — | — | |
| 更新日時 | updated_at | TIMESTAMPTZ | ○ | ON UPDATE NOW() | — | システム | — | — | |

---

## 5. MEMBER_SKILL（メンバースキル評価）

> 評価は上書きではなく追記（履歴保持）。最新評価 = evaluated_at が最大のレコード。

| 論理名 | 物理名 | 型 | 必須 | 制約 | 例 | 出所 | 利用先 | PII | 備考 |
|--------|--------|-----|------|------|----|------|--------|-----|------|
| 評価ID | id | UUID | ○ | PK | `uuid-xxxx` | システム | — | — | |
| メンバーID | member_id | UUID | ○ | FK → MEMBER.id | — | M2-03 | M2-01 マトリクス | — | |
| スキルID | skill_id | UUID | ○ | FK → SKILL.id | — | M2-03 | M2-01 マトリクス | — | |
| スキルレベル | level | SMALLINT | ○ | 1〜5 | `3` | M2-03 | M2-01 セル色分け, M3-04 充足判定 | — | 1=初学者 〜 5=エキスパート |
| 評価日 | evaluated_at | DATE | ○ | 当日以前 | `2026-02-18` | M2-03 | M2-01 最終更新日 | — | |
| 評価メモ | memo | VARCHAR(500) | — | — | `React実務1年` | M2-03 | M2-03 履歴表示 | — | |
| 評価者ID | evaluated_by | UUID | ○ | FK → USER_ACCOUNT.id | — | セッション | AUDIT_LOG | — | |
| 作成日時 | created_at | TIMESTAMPTZ | ○ | DEFAULT NOW() | — | システム | — | — | |

---

## 6. PROJECT（プロジェクト）

| 論理名 | 物理名 | 型 | 必須 | 制約 | 例 | 出所 | 利用先 | PII | 備考 |
|--------|--------|-----|------|------|----|------|--------|-----|------|
| PJ ID | id | UUID | ○ | PK | `uuid-xxxx` | システム | 全PJ関連テーブル | — | |
| PJ名 | name | VARCHAR(200) | ○ | — | `〇〇社AI開発` | M3-03 | M3-01, M6-01/02 | — | |
| 説明 | description | TEXT | — | 最大1000文字 | — | M3-03 | M3-02 | — | |
| ステータス | status | ENUM | ○ | `planning` / `active` / `completed` / `on_hold` | `active` | M3-03 | M3-01 フィルター | — | 計画中/進行中/完了/保留 |
| 所属会社 | company | ENUM | ○ | `boost` / `salt2` | `boost` | M3-03 | M3-01, M6-02 フィルター | — | |
| 開始日 | start_date | DATE | ○ | YYYY-MM-DD | `2026-03-01` | M3-03 | M3-01 | — | |
| 終了日 | end_date | DATE | — | start_date 以降 | `2026-09-30` | M3-03 | M3-01 | — | |
| クライアント名 | client_name | VARCHAR(200) | — | — | `株式会社〇〇` | M3-03 | M3-01 | — | |
| 契約形態 | contract_type | ENUM | — | `quasi_mandate` / `contract` / `in_house` / `other` | `quasi_mandate` | M3-03 | M6-01 | — | 準委任/請負/自社開発/その他 |
| 月額契約金額 | monthly_contract_amount | INTEGER | — | 0以上 | `500000` | M3-03 | M6-01 売上参照 | — | 円 |
| 作成者ID | created_by | UUID | ○ | FK → USER_ACCOUNT.id | — | セッション | AUDIT_LOG | — | |
| 作成日時 | created_at | TIMESTAMPTZ | ○ | DEFAULT NOW() | — | システム | — | — | |
| 更新日時 | updated_at | TIMESTAMPTZ | ○ | ON UPDATE NOW() | — | システム | — | — | |

---

## 7. PROJECT_POSITION（PJポジション）

| 論理名 | 物理名 | 型 | 必須 | 制約 | 例 | 出所 | 利用先 | PII | 備考 |
|--------|--------|-----|------|------|----|------|--------|-----|------|
| ポジションID | id | UUID | ○ | PK | `uuid-xxxx` | システム | PROJECT_ASSIGNMENT.position_id | — | |
| PJ ID | project_id | UUID | ○ | FK → PROJECT.id | — | M3-03 | M3-04 | — | |
| ポジション名 | position_name | VARCHAR(100) | ○ | — | `PM` | M3-03 | M3-04 タブ | — | |
| 必要人数 | required_count | SMALLINT | ○ | 1以上 | `1` | M3-03 | M3-04 表示 | — | |
| 作成日時 | created_at | TIMESTAMPTZ | ○ | DEFAULT NOW() | — | システム | — | — | |
| 更新日時 | updated_at | TIMESTAMPTZ | ○ | ON UPDATE NOW() | — | システム | — | — | |

---

## 8. POSITION_REQUIRED_SKILL（ポジション必要スキル）

| 論理名 | 物理名 | 型 | 必須 | 制約 | 例 | 出所 | 利用先 | PII | 備考 |
|--------|--------|-----|------|------|----|------|--------|-----|------|
| レコードID | id | UUID | ○ | PK | `uuid-xxxx` | システム | — | — | |
| ポジションID | position_id | UUID | ○ | FK → PROJECT_POSITION.id | — | M3-03 | M3-04 スキル充足判定 | — | |
| スキルID | skill_id | UUID | ○ | FK → SKILL.id | — | M3-03 | M3-04 充足判定 | — | |
| 最低レベル | min_level | SMALLINT | ○ | 1〜5 | `3` | M3-03 | M3-04 充足判定 | — | MEMBER_SKILL.level ≥ min_level で充足 |

---

## 9. PROJECT_ASSIGNMENT（アサイン）

| 論理名 | 物理名 | 型 | 必須 | 制約 | 例 | 出所 | 利用先 | PII | 備考 |
|--------|--------|-----|------|------|----|------|--------|-----|------|
| アサインID | id | UUID | ○ | PK | `uuid-xxxx` | システム | — | — | |
| PJ ID | project_id | UUID | ○ | FK → PROJECT.id | — | M3-04 | M3-05 工数, M6-01 人件費 | — | |
| ポジションID | position_id | UUID | ○ | FK → PROJECT_POSITION.id | — | M3-04 | M3-04 重複チェック | — | |
| メンバーID | member_id | UUID | ○ | FK → MEMBER.id | — | M3-04 | M6-01 人件費按分, C-02 | — | |
| 月間想定工数（時間） | workload_hours | INTEGER | ○ | 1以上 | `80` | M3-04 | M3-05, M6-01 按分計算 | — | |
| アサイン開始日 | start_date | DATE | ○ | YYYY-MM-DD | `2026-03-01` | M3-04 | — | — | |
| アサイン終了日 | end_date | DATE | — | start_date 以降 | `2026-09-30` | M3-04 | — | — | NULL = 現在も継続 |
| 作成者ID | created_by | UUID | ○ | FK → USER_ACCOUNT.id | — | セッション | AUDIT_LOG | — | |
| 作成日時 | created_at | TIMESTAMPTZ | ○ | DEFAULT NOW() | — | システム | — | — | |
| 更新日時 | updated_at | TIMESTAMPTZ | ○ | ON UPDATE NOW() | — | システム | — | — | |

---

## 10. WORK_SCHEDULE（勤務予定）

| 論理名 | 物理名 | 型 | 必須 | 制約 | 例 | 出所 | 利用先 | PII | 備考 |
|--------|--------|-----|------|------|----|------|--------|-----|------|
| 予定ID | id | UUID | ○ | PK | `uuid-xxxx` | システム | — | — | |
| メンバーID | member_id | UUID | ○ | FK → MEMBER.id | — | M4-02 | C-02 週間スケジュール | — | |
| 日付 | date | DATE | ○ | YYYY-MM-DD | `2026-03-02` | M4-02 | C-02 カレンダー | — | UNIQUE(member_id, date) |
| 開始時刻 | start_time | TIME | 条件付 | 出勤日は必須 | `10:00` | M4-02 | C-02 カレンダー | — | |
| 終了時刻 | end_time | TIME | 条件付 | start_time 以降 | `19:00` | M4-02 | C-02 カレンダー | — | |
| 終日休み | is_off | BOOLEAN | ○ | DEFAULT false | `false` | M4-02 | — | — | trueの場合start/end_timeは無効 |
| 作成日時 | created_at | TIMESTAMPTZ | ○ | DEFAULT NOW() | — | システム | — | — | |
| 更新日時 | updated_at | TIMESTAMPTZ | ○ | ON UPDATE NOW() | — | システム | — | — | |

---

## 11. ATTENDANCE（勤怠）

| 論理名 | 物理名 | 型 | 必須 | 制約 | 例 | 出所 | 利用先 | PII | 備考 |
|--------|--------|-----|------|------|----|------|--------|-----|------|
| 勤怠ID | id | UUID | ○ | PK | `uuid-xxxx` | システム | — | — | |
| メンバーID | member_id | UUID | ○ | FK → MEMBER.id | — | M4-03 | M4-04, M5-01, M6-01 | — | |
| 日付 | date | DATE | ○ | YYYY-MM-DD | `2026-02-18` | システム | M4-04 | — | UNIQUE(member_id, date) |
| 出勤時刻 | clock_in | TIMESTAMPTZ | — | — | `2026-02-18T10:00:00Z` | M4-03 出勤ボタン | M4-04 | — | NULL = 未出勤 |
| 退勤時刻 | clock_out | TIMESTAMPTZ | — | clock_in 以降 | `2026-02-18T19:00:00Z` | M4-03 退勤ボタン | M4-04 | — | NULL = 未退勤 |
| 休憩時間（分） | break_minutes | INTEGER | — | 0以上 | `60` | M4-03 退勤時 | M4-04 実働計算 | — | |
| 実働時間（分） | work_minutes | INTEGER | — | 自動計算 | `480` | システム計算 | M5-01 集計 | — | (clock_out - clock_in) - break_minutes |
| 今日やること | todo_today | VARCHAR(500) | 条件付 | 出勤時必須 | `〇〇機能の実装` | M4-03 出勤時 | M4-04 日報, Slack通知 | △ | |
| 今日やったこと | done_today | VARCHAR(500) | 条件付 | 退勤時必須 | `〇〇機能完成` | M4-03 退勤時 | M4-04 日報, Slack通知 | △ | |
| 明日やること | todo_tomorrow | VARCHAR(500) | 条件付 | 退勤時必須 | `テストを書く` | M4-03 退勤時 | Slack通知 | △ | |
| レコード状態 | status | ENUM | ○ | `normal` / `modified` / `absent` | `normal` | システム / M4-04 | M4-04 | — | 通常/修正済/欠勤 |
| 確認状態 | confirm_status | ENUM | ○ | `unconfirmed` / `confirmed` / `approved` | `unconfirmed` | M4-04, M5-01 | M5-01 集計 | — | 未確認/確認済/承認済 |
| Slack通知済み | slack_notified | BOOLEAN | ○ | DEFAULT false | `true` | M4-03 | M5-01 未打刻チェック | — | |
| 作成日時 | created_at | TIMESTAMPTZ | ○ | DEFAULT NOW() | — | システム | — | — | |
| 更新日時 | updated_at | TIMESTAMPTZ | ○ | ON UPDATE NOW() | — | システム | — | — | |

---

## 12. INVOICE（請求書）

| 論理名 | 物理名 | 型 | 必須 | 制約 | 例 | 出所 | 利用先 | PII | 備考 |
|--------|--------|-----|------|------|----|------|--------|-----|------|
| 請求書ID | id | UUID | ○ | PK | `uuid-xxxx` | システム | — | — | |
| 請求書番号 | invoice_number | VARCHAR(20) | ○ | UNIQUE / `YYYY-MM-{連番}` | `2026-02-001` | システム | M5-02 | — | |
| メンバーID | member_id | UUID | ○ | FK → MEMBER.id | — | M5-01 | M5-02 | — | |
| 対象年月 | target_month | CHAR(7) | ○ | `YYYY-MM` | `2026-02` | M5-01 | M5-02 フィルター | — | |
| 合計勤務時間 | work_hours_total | NUMERIC(6,2) | ○ | 0以上 | `142.50` | M5-01 集計 | M5-02, INVOICE xlsx | — | 時間単位 |
| 時給単価 | unit_price | INTEGER | ○ | 正の整数 | `2000` | MEMBER.salary_amount | M5-02（管理者のみ表示） | ○ | 円 |
| 請求金額（税抜） | amount_excl_tax | INTEGER | ○ | 0以上 | `285000` | システム計算 | M5-02 | — | work_hours_total × unit_price |
| 請求金額（税込） | amount_incl_tax | INTEGER | ○ | 0以上 | `313500` | システム計算 | M5-02 | — | amount_excl_tax × 1.1 |
| ファイルパス | file_path | TEXT | — | ストレージ上のパス | `invoices/2026-02/001.xlsx` | M5-01 生成 | M5-02 ダウンロード | — | |
| Slack送付状態 | slack_sent_status | ENUM | ○ | `unsent` / `sent` | `sent` | M5-01 / M5-02 | M5-02 | — | |
| 発行日 | issued_at | DATE | ○ | — | `2026-03-01` | M5-01 | M5-02 | — | |
| 作成日時 | created_at | TIMESTAMPTZ | ○ | DEFAULT NOW() | — | システム | — | — | |
| 更新日時 | updated_at | TIMESTAMPTZ | ○ | ON UPDATE NOW() | — | システム | — | — | |

---

## 13. PL_RECORD（PL / CFレコード）

> M6-01（PJ別PL）と M6-03（キャッシュフロー）を同一テーブルで管理。
> `record_type` で PL / CF を区別する。CF レコードは `project_id = NULL`。

| 論理名 | 物理名 | 型 | 必須 | 制約 | 例 | 出所 | 利用先 | PII | 備考 |
|--------|--------|-----|------|------|----|------|--------|-----|------|
| レコードID | id | UUID | ○ | PK | `uuid-xxxx` | システム | — | — | |
| レコード種別 | record_type | ENUM | ○ | `pl` / `cf` | `pl` | M6-01/03 | M6-01, M6-03 | — | |
| PJ ID | project_id | UUID | — | FK → PROJECT.id / NULL(CF) | — | M6-01 | M6-01/02 | — | CF時はNULL |
| 対象年月 | target_month | CHAR(7) | ○ | `YYYY-MM` | `2026-02` | M6-01 | M6-01/02/03 | — | UNIQUE(project_id, target_month, record_type) |
| 月額契約売上 | revenue_contract | INTEGER | — | 0以上 | `500000` | M6-01 手動入力 | M6-01/02 | — | 円 |
| 追加売上 | revenue_extra | INTEGER | — | 0以上 | `100000` | M6-01 手動入力 | M6-01/02 | — | 円 |
| 人件費（月額按分） | cost_labor_monthly | INTEGER | — | 自動計算 | `300000` | システム（アサイン工数×月額按分） | M6-01/02 | — | 月額固定メンバー分 |
| 人件費（時給実績） | cost_labor_hourly | INTEGER | — | 自動計算 | `80000` | システム（勤怠実績×時給） | M6-01/02 | — | 時給制メンバー分 |
| 外注費 | cost_outsourcing | INTEGER | — | 0以上 | `80000` | M6-01 手動入力 | M6-01/02 | — | 円 |
| その他経費 | cost_other | INTEGER | — | 0以上 | `10000` | M6-01 手動入力 | M6-01/02 | — | 円 |
| 粗利 | gross_profit | INTEGER | — | 自動計算 | `130000` | システム | M6-01/02 | — | 売上合計 − コスト合計 |
| 粗利率 | gross_profit_rate | NUMERIC(5,2) | — | 自動計算・売上0時はNULL | `21.67` | システム | M6-01/02 | — | % / NULL = 「—」表示 |
| CF: クライアント入金 | cf_cash_in_client | INTEGER | — | 0以上 / CF時のみ | `500000` | M6-03 | M6-03 | — | 円 |
| CF: その他入金 | cf_cash_in_other | INTEGER | — | 0以上 / CF時のみ | `0` | M6-03 | M6-03 | — | 円 |
| CF: 給与支払い | cf_cash_out_salary | INTEGER | — | 自動計算 / CF時のみ | `285000` | INVOICEより自動 | M6-03 | — | 円 |
| CF: 外注費支払い | cf_cash_out_outsourcing | INTEGER | — | 0以上 / CF時のみ | `80000` | M6-03 | M6-03 | — | 円 |
| CF: 固定費 | cf_cash_out_fixed | INTEGER | — | 0以上 / CF時のみ | `200000` | M6-03 | M6-03 | — | 円 |
| CF: その他支出 | cf_cash_out_other | INTEGER | — | 0以上 / CF時のみ | `10000` | M6-03 | M6-03 | — | 円 |
| CF: 前月繰越残高 | cf_balance_prev | INTEGER | — | CF時のみ・初回必須 | `3000000` | M6-03 手動入力 | M6-03 | — | 円 |
| CF: 月末残高 | cf_balance_current | INTEGER | — | 自動計算 / CF時のみ | `2925000` | システム | M6-03 | — | 前月残高 + 月次収支 |
| 備考 | memo | VARCHAR(200) | — | — | `〇〇社3月分入金` | M6-03 | M6-03 | — | |
| 作成者ID | created_by | UUID | ○ | FK → USER_ACCOUNT.id | — | セッション | AUDIT_LOG | — | |
| 作成日時 | created_at | TIMESTAMPTZ | ○ | DEFAULT NOW() | — | システム | — | — | |
| 更新日時 | updated_at | TIMESTAMPTZ | ○ | ON UPDATE NOW() | — | システム | — | — | |

---

## 14. AUDIT_LOG（監査ログ）

> 全書き込み操作（CREATE / UPDATE / DELETE）で自動記録。削除・改ざん不可。

| 論理名 | 物理名 | 型 | 必須 | 制約 | 例 | 出所 | 利用先 | PII | 備考 |
|--------|--------|-----|------|------|----|------|--------|-----|------|
| ログID | id | UUID | ○ | PK | `uuid-xxxx` | システム | — | — | |
| 操作者ID | operator_id | UUID | ○ | FK → USER_ACCOUNT.id | — | セッション | 監査確認 | — | |
| 対象テーブル | target_table | VARCHAR(100) | ○ | — | `MEMBER` | システム | 監査確認 | — | |
| 対象レコードID | target_id | UUID | ○ | — | `uuid-xxxx` | システム | 監査確認 | — | |
| 操作種別 | action | ENUM | ○ | `CREATE` / `UPDATE` / `DELETE` | `UPDATE` | システム | 監査確認 | — | |
| 変更前データ | before_data | JSONB | — | NULL(CREATE時) | `{"name":"旧名前"}` | システム | 監査確認 | △ | 個人情報を含む可能性あり |
| 変更後データ | after_data | JSONB | — | NULL(DELETE時) | `{"name":"新名前"}` | システム | 監査確認 | △ | 個人情報を含む可能性あり |
| IPアドレス | ip_address | VARCHAR(45) | ○ | IPv4 or IPv6 | `203.0.113.1` | リクエスト | セキュリティ調査 | ○ | |
| 操作日時 | created_at | TIMESTAMPTZ | ○ | DEFAULT NOW() | — | システム | — | — | |

---

## PII 区分 凡例

| 区分 | 意味 |
|------|------|
| ○ | 個人識別情報（取扱い要注意） |
| △ | 間接的に個人情報を含む可能性あり |
| — | 個人情報なし |

> **暗号化対象**: `MEMBER.bank_name` / `bank_branch` / `bank_account_number` / `bank_account_holder` は AES-256 で暗号化してDB保存。
> **表示制限**: `salary_amount` / `unit_price` は管理者・本人のみ参照可。

---

次は `/design-db` でDB設計書（テーブル定義・ER図）を作成してください。
