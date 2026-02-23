# M5-01 月末締め管理 — 要件定義 v2（確定版）

> 作成日: 2026-02-20 | v1 → v2 更新

---

## v1 からの変更点

| 区分 | 内容 |
|------|------|
| データ要件 | テーブル名を物理名に統一 |
| 非機能要件 | 集計処理をバックグラウンドジョブ（最大 30 秒）として明記 |
| 運用要件 | セクション新設 |

---

## 機能要件（確定）

| 優先度 | 要件 |
|--------|------|
| Must | 時給制メンバー一覧と確認状況（未送信 / 確認待ち / 確認済 / 修正依頼中）を表示する |
| Must | 「集計実行」で当月の全勤怠データを集計して給与を計算する |
| Must | 未打刻日ありで集計実行しようとすると警告ダイアログを表示する |
| Must | 「Slack 確認依頼送信」で未確認メンバーへ Slack メンション付き確認依頼を一括送信する |
| Must | 個別に再通知できる |
| Must | 「強制確定」で未確認メンバーを強制的に `confirm_status = 'confirmed'` にし請求書生成へ進められる |
| Must | 確認済みメンバー全員の請求書を一括生成できる（`invoices` テーブルへの INSERT） |
| Must | 請求書生成後、自動で Slack 本人DMに請求書ファイルを送付する（6.3送付要件） |
| Must | 管理者以外はアクセス不可（403） |
| Should | 請求書生成状態（未生成 / 生成済 / 送付済）を一覧に表示する |
| Should | 未打刻日数が 0 件以外の行をオレンジ強調する |

---

## データ要件（確定）

| テーブル | カラム | 備考 |
|---------|--------|------|
| `attendances` | `member_id`, `date`, `work_minutes`, `status`, `confirm_status` | 集計対象 |
| `members` | `id`, `name`, `salary_type`, `salary_amount` | 時給制メンバーのみ表示（`salary_type = 'hourly'`） |
| `invoices` | `id`, `member_id`, `target_month`, `slack_sent_status` | 請求書生成状態管理 |
| `invoices` (拡張) | `file_path`, `file_hash`, `slack_dm_status` | 請求書ファイル格納先とSlack送付状態 |

**請求書生成時の INSERT 仕様（確定）:**
```sql
INSERT INTO invoices (
  invoice_number, member_id, target_month,
  work_hours_total, unit_price, amount_excl_tax, amount_incl_tax,
  slack_sent_status, issued_at
)
VALUES (
  :invoiceNumber,        -- YYYY-MM-{001〜}
  :memberId,
  :targetMonth,          -- YYYY-MM
  :workHoursTotal,       -- SUM(work_minutes) / 60
  :unitPrice,            -- members.salary_amount
  :amountExclTax,        -- work_hours_total × unit_price
  :amountInclTax,        -- amount_excl_tax × 1.1
  'unsent',
  CURRENT_DATE
)
ON CONFLICT (member_id, target_month) DO UPDATE SET ...;
```

**Slack 通知テンプレート（確定）:**
```
@[氏名]さん 今月の勤怠を確認してください
勤務日数: X日 / 合計時間: Y時間 / 給与見込: Z円
確認はこちら: [M4-04 へのリンク]
```

---

## 非機能要件（確定）

| 区分 | 内容 |
|------|------|
| 性能 | 集計実行はバックグラウンドジョブで処理し 30 秒以内に完了。進捗状態をポーリングで画面表示する |
| セキュリティ | 管理者ロールのみアクセス可（サーバー側検証） |
| 監査 | 集計実行・強制確定・請求書生成操作を `audit_logs` に記録（action = 'CREATE'/'UPDATE'、対象月） |
| ログ | Slack 送信失敗・集計エラーをサーバーログに `ERROR` レベルで記録 |
| 可用性 | Slack 送信失敗は集計・請求書生成の正常完了に影響しない |

---

## 運用要件

| 項目 | 内容 |
|------|------|
| バックアップ | `invoices` は日次バックアップ対象 |
| データ保持 | 請求書データは 7 年間保持（税務書類の法定保存期間に準拠） |
| 締め処理スケジュール | 毎月 `system_configs.monthly_closing_notify_day` 日に Slack 通知を自動送信するバッチを設定する運用を推奨 |

---

## 受け入れ条件（確定）

- [ ] 管理者でアクセスすると時給制メンバー一覧と確認状況が表示される
- [ ] 管理者以外でアクセスすると 403 が返る
- [ ] 「集計実行」で全メンバーの勤務時間と給与見込みが計算される
- [ ] 未打刻日ありで集計実行すると「X 名に未打刻日があります。このまま集計しますか？」のダイアログが表示される
- [ ] 「Slack 確認依頼送信」で未確認メンバー全員に Slack メンションが送信される
- [ ] Slack 送信失敗時にエラートーストと個別再送ボタンが表示される
- [ ] 「強制確定」で指定メンバーの `confirm_status` が `'confirmed'` になる
- [ ] 「請求書生成」で `invoices` テーブルにレコードが作成される
- [ ] `audit_logs` に集計・請求書生成のレコードが追加されている
