# M5-02 請求書一覧 — 要件定義 v2（確定版）

> 作成日: 2026-02-20 | v1 → v2 更新

---

## v1 からの変更点

| 区分 | 内容 |
|------|------|
| データ要件 | テーブル名・カラム名を物理名に統一。請求書番号採番ロジックを SQL で確定。`amount_boost` / `amount_salt2`（会社別按分請求額）を追加 |
| 非機能要件 | ファイルアクセスは署名付き URL（S3）を使用と明記 |
| 運用要件 | セクション新設 |

---

## 機能要件（確定）

| 優先度 | 要件 |
|--------|------|
| Must | 請求書一覧を表示する（請求書番号・対象年月・氏名・勤務時間合計・請求金額・発行日・Slack 送付状態） |
| Must | 対象月でフィルタリングできる |
| Must | 管理者はメンバーでもフィルタリングできる |
| Must | Excel ファイル（.xlsx）をダウンロードできる（署名付き URL 経由） |
| Must | 管理者は勤怠修正後に請求書を再生成できる |
| Must | Slack DM で再送信できる（本人DMにファイル添付） |
| Must | 管理者は全員分の請求書を閲覧・ダウンロード・再生成できる |
| Must | インターン・社員は自分の請求書のみ閲覧・ダウンロードできる（再生成は不可） |
| Must | 時給単価は管理者のみ表示する |
| Should | 請求書番号のフォーマットは `YYYY-MM-{3桁連番}` とし、月単位でリセットする |

---

## データ要件（確定）

| テーブル | カラム | 制約 |
|---------|--------|------|
| `invoices` | `id`, `invoice_number`, `member_id`, `target_month`, `work_hours_total`, `unit_price`, `amount_excl_tax`, `amount_incl_tax`, `amount_boost`, `amount_salt2`, `issued_at`, `file_path`, `slack_sent_status` | — |
| `members` | `id`, `name`, `salary_amount` | 時給単価表示用（管理者のみ） |
| `project_assignments` | `member_id`, `project_id`, `workload_hours` | 会社別按分率計算用 |
| `projects` | `id`, `company` | Boost / SALT2 工数集計用 |

**請求書番号採番ルール（確定）:**
```sql
-- 当月の最大連番 + 1 を取得
SELECT COALESCE(MAX(CAST(RIGHT(invoice_number, 3) AS INTEGER)), 0) + 1
FROM invoices
WHERE target_month = :targetMonth;
-- フォーマット: YYYY-MM-001
```

**消費税計算（確定）:**
- 税抜金額 = `FLOOR(work_hours_total × unit_price)`（小数点以下切捨て）
- 税込金額 = `FLOOR(amount_excl_tax × 1.1)`

**会社別按分請求額の計算（確定）:**
```
-- 当月のアサイン工数合計 / 会社別工数合計 = 按分率
boost_hours  = SUM(workload_hours) WHERE project.company = 'boost'
salt2_hours  = SUM(workload_hours) WHERE project.company = 'salt2'
total_hours  = boost_hours + salt2_hours

amount_boost = ROUND(amount_excl_tax × boost_hours / total_hours)
amount_salt2 = amount_excl_tax - amount_boost  -- 端数をSALT2側に
```
> アサイン情報が存在しない場合: `amount_boost = amount_excl_tax`, `amount_salt2 = 0`（全額Boost計上）

**xlsx に含める項目（確定）:**
氏名・対象月・勤務日数・勤務時間合計・時給単価・税抜金額・消費税・税込金額・**Boost向け請求額・SALT2向け請求額**・銀行名・支店名・口座番号・口座名義

---

## 非機能要件（確定）

| 区分 | 内容 |
|------|------|
| 性能 | ダウンロード応答 3 秒以内（署名付き URL のリダイレクト含む） |
| セキュリティ | 認証必須。ファイルアクセスは署名付き URL（有効期限 5 分）を使用。他メンバーの請求書 URL への直接アクセスはサーバー側で拒否 |
| 監査 | ダウンロード・再生成・Slack 送信を `audit_logs` に記録 |
| ログ | ファイル生成失敗・Slack 送信失敗をサーバーログに記録 |
| 可用性 | 再生成失敗時は既存ファイルを維持する |

---

## 運用要件

| 項目 | 内容 |
|------|------|
| バックアップ | `invoices` は日次バックアップ対象。xlsx ファイルは S3 バージョニングで管理 |
| データ保持 | 請求書データ・ファイルは 7 年間保持（税務書類の法定保存期間） |
| 権限運用 | ダウンロードは本人・管理者のみ。再生成は管理者のみ |

---

## 受け入れ条件（確定）

- [ ] インターンでアクセスすると自分の請求書のみ表示される
- [ ] 管理者でアクセスすると全員分の請求書が表示される
- [ ] 「ダウンロード」で署名付き URL 経由で .xlsx ファイルがダウンロードされる
- [ ] ファイルが存在しない場合「請求書が見つかりません。再生成してください」が表示される
- [ ] 管理者が「再生成」すると最新の勤怠データで請求書が更新される
- [ ] 「Slack 再送」でインターン本人の Slack DM に請求書通知が送信される
- [ ] Slack 再送失敗時にエラートーストが表示される
- [ ] 時給単価の列は管理者のみ表示される
- [ ] 請求書番号が `2026-03-001` の形式で表示される
