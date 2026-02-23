# M6-01 PJ 別 PL — 要件定義 v2（確定版）

> 作成日: 2026-02-20 | v1 → v2 更新

---

## v1 からの変更点

| 区分 | 内容 |
|------|------|
| データ要件 | テーブル名を物理名に統一。人件費按分計算式を SQL で確定。`cost_tools` カラム追加（ツール費用） |
| 機能要件 | ツール費用コスト項目を追加（`member_tools` から会社/PJ配分で按分） |
| 非機能要件 | 確定値に更新 |
| 運用要件 | セクション新設 |

---

## 機能要件（確定）

| 優先度 | 要件 |
|--------|------|
| Must | PJ・対象月を選択し、月次損益テーブル（売上・コスト・粗利・粗利率）を表示する |
| Must | 月額契約売上・追加売上・外注費・その他経費を手動入力できる |
| Must | 月額固定メンバーの人件費を自動計算する（月額報酬 × 当該 PJ 工数 / 全 PJ 合計工数） |
| Must | 時給制メンバーの人件費を自動計算する（勤怠実績時間 × 時給） |
| Must | ツール費用（`cost_tools`）を PJ の会社ラベルに一致する `member_tools` の月額合計から自動計算する |
| Must | 粗利 = 売上合計 − コスト合計、粗利率 = 粗利 / 売上合計 を自動計算する |
| Must | 管理者は全 PJ を閲覧・入力できる |
| Must | マネージャーは担当 PJ のみ閲覧・入力できる |
| Must | 社員・インターンはアクセス不可（403） |
| Must | 勤怠未集計の月の人件費には警告メッセージを表示する |
| Should | 月次推移グラフ（売上・コスト・粗利の折れ線）を表示する |

---

## データ要件（確定）

| テーブル | カラム | 備考 |
|---------|--------|------|
| `pl_records` | `id`, `project_id`, `target_month`, `revenue_contract`, `revenue_extra`, `cost_labor_monthly`, `cost_labor_hourly`, `cost_outsourcing`, `cost_tools`, `cost_other`, `gross_profit`, `gross_profit_rate` | `record_type = 'pl'` のレコード |
| `project_assignments` | `member_id`, `project_id`, `workload_hours` | 工数比率計算用 |
| `members` | `id`, `salary_type`, `salary_amount` | 人件費計算用 |
| `attendances` | `member_id`, `work_minutes` | 時給制人件費（勤怠集計後） |
| `member_tools` | `member_id`, `monthly_cost`, `company_label` | ツール費用自動計算用 |

**月額固定メンバー人件費の計算（確定）:**
```sql
-- 全アサイン工数合計（当月アクティブ）
SELECT member_id,
  SUM(workload_hours) AS total_hours,
  SUM(CASE WHEN project_id = :targetProjectId THEN workload_hours ELSE 0 END) AS pj_hours
FROM project_assignments
WHERE start_date <= :monthEnd
  AND (end_date IS NULL OR end_date >= :monthStart)
GROUP BY member_id

-- 按分計算
cost_labor_monthly = SUM(salary_amount × pj_hours / total_hours)
  WHERE salary_type = 'monthly'
```

**時給制メンバー人件費の計算（確定）:**
```sql
cost_labor_hourly = SUM(work_minutes / 60.0 × salary_amount)
  WHERE salary_type = 'hourly'
  AND date BETWEEN :monthStart AND :monthEnd
```

**ツール費用の計算（確定）:**
```sql
-- PJの company と一致するメンバーのツール費用合計（当月アサイン中メンバーのみ）
cost_tools = SELECT SUM(mt.monthly_cost)
FROM member_tools mt
JOIN project_assignments pa ON pa.member_id = mt.member_id
WHERE pa.project_id = :projectId
  AND mt.company_label = :projectCompany
  AND pa.start_date <= :monthEnd
  AND (pa.end_date IS NULL OR pa.end_date >= :monthStart)
```

> 注: `company_label` が PJ の `company` と一致するツールのみ計上。手動上書き可。

**粗利計算（確定）:**
```
gross_profit = (revenue_contract + revenue_extra) - (cost_labor_monthly + cost_labor_hourly + cost_outsourcing + cost_tools + cost_other)
gross_profit_rate = CASE WHEN (revenue_contract + revenue_extra) = 0 THEN NULL ELSE gross_profit / (revenue_contract + revenue_extra) * 100 END
```

---

## 非機能要件（確定）

| 区分 | 内容 |
|------|------|
| 性能 | PL データ表示 2 秒以内 |
| セキュリティ | 認証必須。マネージャーの担当外 PJ アクセスはサーバー側で拒否 |
| 監査 | PL 手動入力の変更を `audit_logs` に記録（action = 'CREATE'/'UPDATE'、変更前後の値） |
| ログ | 計算エラー・DB エラーをサーバーログに記録 |
| 可用性 | 勤怠未集計でも手動入力項目は表示・保存できること |

---

## 運用要件

| 項目 | 内容 |
|------|------|
| バックアップ | `pl_records` は日次バックアップ対象 |
| データ保持 | PL レコードは 7 年間保持（財務データの保存要件） |
| 権限運用 | PL 閲覧は admin / manager（担当 PJ のみ）。社員・インターンは不可 |

---

## 受け入れ条件（確定）

- [ ] 管理者が売上・コストを入力して保存すると `pl_records` が更新される
- [ ] 月額固定メンバーの人件費が `月額報酬 × (当該PJ工数 / 全PJ合計工数)` で自動計算される
- [ ] 時給制メンバーの人件費が `勤怠実績時間 × 時給` で自動計算される
- [ ] ツール費用が当月アサイン中メンバーの `member_tools.monthly_cost`（PJ会社と一致するもの）の合計で自動計算される
- [ ] 粗利・粗利率が自動計算される（売上 0 の場合は「—」表示）
- [ ] 勤怠未集計月にアクセスすると警告メッセージが表示される
- [ ] マネージャーが担当外 PJ の PL にアクセスすると 403 が返る
- [ ] `audit_logs` に PL 変更のレコードが追加されている
