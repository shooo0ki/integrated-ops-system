# M6-03 キャッシュフロー管理 — 要件定義 v2（確定版）

> 作成日: 2026-02-20 | v1 → v2 更新

---

## v1 からの変更点

| 区分 | 内容 |
|------|------|
| データ要件 | テーブル名を物理名に統一。v1 で CF 項目を別テーブル記述していたが DB 設計に合わせ `pl_records` (record_type='cf') に統一 |
| 非機能要件 | 確定値に更新 |
| 運用要件 | セクション新設 |

---

## 機能要件（確定）

| 優先度 | 要件 |
|--------|------|
| Must | 対象月を選択し、キャッシュイン（クライアント入金・その他入金）とキャッシュアウト（給与支払い・外注費・固定費・その他支出）を管理する |
| Must | 給与支払い（`cf_cash_out_salary`）は確定済み請求書の合計から自動計算する |
| Must | その他の各項目は手動入力できる |
| Must | 月次収支（キャッシュイン合計 − キャッシュアウト合計）を自動計算する |
| Must | 月末残高（`cf_balance_prev` + 月次収支）を自動計算して `cf_balance_current` に保存する |
| Must | 初回のみ `cf_balance_prev`（前月繰越残高）を必須入力として設定する |
| Must | 月次残高推移グラフを表示する |
| Must | 管理者以外はアクセス不可（403） |
| Should | 前月・翌月ナビゲーションで月を切り替えられる |
| Should | `memo` フィールドに備考を入力できる（最大 200 文字） |

---

## データ要件（確定）

| テーブル | カラム | 備考 |
|---------|--------|------|
| `pl_records` | `id`, `target_month`, `record_type`, `cf_cash_in_client`, `cf_cash_in_other`, `cf_cash_out_salary`, `cf_cash_out_outsourcing`, `cf_cash_out_fixed`, `cf_cash_out_other`, `cf_balance_prev`, `cf_balance_current`, `memo`, `created_by` | `record_type = 'cf'`、`project_id = NULL` |
| `invoices` | `amount_incl_tax`, `target_month` | 給与支払い自動計算用（確定済み請求書の合計） |

**CF レコードの項目定義（確定）:**

| 区分 | カラム | 入力方式 |
|------|--------|---------|
| キャッシュイン | `cf_cash_in_client` | 手動 |
| キャッシュイン | `cf_cash_in_other` | 手動 |
| キャッシュアウト | `cf_cash_out_salary` | 自動（確定請求書合計） |
| キャッシュアウト | `cf_cash_out_outsourcing` | 手動 |
| キャッシュアウト | `cf_cash_out_fixed` | 手動 |
| キャッシュアウト | `cf_cash_out_other` | 手動 |

**自動計算値（確定）:**
```
月次収支 = (cf_cash_in_client + cf_cash_in_other) - (cf_cash_out_salary + cf_cash_out_outsourcing + cf_cash_out_fixed + cf_cash_out_other)
cf_balance_current = cf_balance_prev + 月次収支

cf_cash_out_salary = SELECT SUM(amount_incl_tax) FROM invoices WHERE target_month = :targetMonth
```

**前月残高の引き継ぎ:**
```sql
-- 前月の cf_balance_current を当月の cf_balance_prev として自動セット
SELECT cf_balance_current FROM pl_records
WHERE record_type = 'cf'
  AND target_month = TO_CHAR(DATE_TRUNC('month', :targetMonth::DATE) - INTERVAL '1 month', 'YYYY-MM')
```

---

## 非機能要件（確定）

| 区分 | 内容 |
|------|------|
| 性能 | データ表示 2 秒以内 |
| セキュリティ | 管理者ロールのみアクセス可（サーバー側検証） |
| 監査 | 金額の変更を `audit_logs` に記録（action = 'CREATE'/'UPDATE'、変更前後の値） |
| ログ | DB エラーをサーバーログに記録 |
| 可用性 | 前月残高未設定でも画面が表示でき、入力フォームが表示されること |

---

## 運用要件

| 項目 | 内容 |
|------|------|
| バックアップ | `pl_records`（CF区分）は日次バックアップ対象 |
| データ保持 | CF データは 7 年間保持（財務データの保存要件） |
| 初期設定 | システム初回利用時に管理者が `cf_balance_prev` を手動設定する |

---

## 受け入れ条件（確定）

- [ ] 管理者でアクセスすると当月のキャッシュフロー画面が表示される
- [ ] 管理者以外でアクセスすると 403 が返る
- [ ] クライアント入金を入力して保存すると月次収支・月末残高が自動更新される
- [ ] 給与支払い欄が確定済み請求書の `amount_incl_tax` 合計で自動表示される
- [ ] 初回アクセス時（前月残高未設定）に「前月残高を入力してください（初回設定）」が表示される
- [ ] 月次残高推移グラフが表示される
- [ ] 備考に 200 文字を超えた文字を入力するとバリデーションエラーが表示される
- [ ] `audit_logs` に CF 変更のレコードが追加されている
