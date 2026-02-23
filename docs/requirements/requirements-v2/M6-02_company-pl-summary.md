# M6-02 全社 PL サマリー — 要件定義 v2（確定版）

> 作成日: 2026-02-20 | v1 → v2 更新

---

## v1 からの変更点

| 区分 | 内容 |
|------|------|
| データ要件 | テーブル名を物理名に統一。全社合計の集計ロジックを SQL で確定 |
| 非機能要件 | 確定値に更新 |
| 運用要件 | セクション新設 |

---

## 機能要件（確定）

| 優先度 | 要件 |
|--------|------|
| Must | ブーストコンサルティング / SALT2 / 両社 を選択し、全 PJ を合算した会社全体の損益を表示する |
| Must | PJ 別明細（売上合計・コスト合計・粗利・粗利率）と全社合計行を表示する |
| Must | 対象月を選択できる（前月・翌月ナビゲーション付き） |
| Must | 管理者以外はアクセス不可（403） |
| Must | PJ が 0 件の場合は案内メッセージを表示する |
| Should | 月次推移グラフ（売上・コスト・粗利の折れ線）を表示する |
| Should | PJ 別粗利率ランキングを表示する |
| Should | PJ 名クリックで M6-01 PJ 別 PL に遷移する |

---

## データ要件（確定）

| テーブル | カラム | 備考 |
|---------|--------|------|
| `pl_records` | `project_id`, `target_month`, `revenue_contract`, `revenue_extra`, `cost_labor_monthly`, `cost_labor_hourly`, `cost_outsourcing`, `cost_tools`, `cost_other`, `gross_profit`, `gross_profit_rate` | `record_type = 'pl'` のレコード |
| `projects` | `id`, `name`, `company`, `deleted_at` | PJ 別表示・会社フィルター |

**全社合計集計 SQL（確定）:**
```sql
SELECT
  p.company,
  SUM(pl.revenue_contract + pl.revenue_extra) AS total_revenue,
  SUM(pl.cost_labor_monthly + pl.cost_labor_hourly + pl.cost_outsourcing + pl.cost_tools + pl.cost_other) AS total_cost,
  SUM(pl.gross_profit) AS total_gross_profit,
  CASE WHEN SUM(pl.revenue_contract + pl.revenue_extra) = 0
    THEN NULL
    ELSE SUM(pl.gross_profit)::NUMERIC / SUM(pl.revenue_contract + pl.revenue_extra) * 100
  END AS gross_profit_rate
FROM pl_records pl
JOIN projects p ON p.id = pl.project_id
WHERE pl.target_month = :targetMonth
  AND pl.record_type = 'pl'
  AND p.deleted_at IS NULL
  AND (:company = 'all' OR p.company = :company)
GROUP BY p.company
```

---

## 非機能要件（確定）

| 区分 | 内容 |
|------|------|
| 性能 | サマリー表示 2 秒以内 |
| セキュリティ | 管理者ロールのみアクセス可（サーバー側検証） |
| 監査 | 閲覧ログ（ユーザー ID・タイムスタンプ）をサーバーログに記録 |
| ログ | API エラーをサーバーログに記録 |
| 可用性 | PL レコードが 0 件でもエラーにならず案内メッセージを表示 |

---

## 運用要件

| 項目 | 内容 |
|------|------|
| バックアップ | `pl_records` は日次バックアップ対象 |
| データ保持 | PL データは 7 年間保持 |
| 権限運用 | 全社 PL 閲覧は admin のみ |

---

## 受け入れ条件（確定）

- [ ] 管理者でアクセスすると当月の全社 PL サマリーが表示される
- [ ] 管理者以外でアクセスすると 403 が返る
- [ ] 会社フィルター「SALT2」で SALT2 の PJ のみ集計された値が表示される
- [ ] PJ が 0 件の場合「進行中のプロジェクトがありません」が表示される
- [ ] 全社合計行が全 PJ の合算で正しく表示される
- [ ] 粗利率は売上 0 の場合「—」で表示される
- [ ] PJ 名クリックで M6-01 に遷移する
