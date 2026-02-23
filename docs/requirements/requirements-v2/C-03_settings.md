# C-03 設定画面 — 要件定義 v2（確定版）

> 作成日: 2026-02-20 | v1 → v2 更新

---

## v1 からの変更点

| 区分 | 内容 |
|------|------|
| データ要件 | `SYSTEM_CONFIG` テーブルをDB設計に新規追加定義（data-list.md 未記載のため本ファイルで確定） |
| 非機能要件 | Webhook URL のログマスク要件を明記 |
| 運用要件 | セクション新設 |

---

## 機能要件（確定）

| 優先度 | 要件 |
|--------|------|
| Must | Slack Webhook URL・勤怠通知チャンネル・月末締め通知日を登録・更新できる |
| Must | Slack連携イベントの送信先を設定できる（出勤/退勤=指定チャンネル、月末勤怠確認=本人メンション、請求書生成完了=本人DM） |
| Must | 会社名（親会社・子会社）を登録・更新できる |
| Must | 保存ボタンで設定値を DB に書き込む |
| Must | 「Slack 接続テスト」ボタンで Webhook にテストメッセージを送信し、疎通確認結果を画面に表示する |
| Should | 社内精算設定（内部取引相殺ON/OFF、デフォルト支払元=所属会社）を設定できる |
| Must | 管理者以外はこの画面にアクセスできない（403 を返す） |
| Should | タブ UI で「Slack 連携設定」「会社情報」「システム情報」を切り替え表示する |
| Could | ロール・権限設定タブを将来拡張として UI スロットのみ確保する（v1 では空実装） |

---

## データ要件（確定）

### system_configs テーブル（新規追加）

> DB設計書に追加が必要。`database-design.md` に以下を追記すること。

```sql
CREATE TABLE system_configs (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  key         VARCHAR(100)  NOT NULL,
  value       TEXT          NOT NULL,
  is_secret   BOOLEAN       NOT NULL    DEFAULT false, -- trueの場合は暗号化保存・ログ出力禁止
  updated_by  UUID          NOT NULL    REFERENCES user_accounts(id),
  updated_at  TIMESTAMPTZ   NOT NULL    DEFAULT NOW(),

  CONSTRAINT uq_system_configs_key  UNIQUE (key)
);
```

**設定キー一覧（確定）:**

| キー | 型 | 暗号化 | デフォルト値 |
|------|-----|--------|------------|
| `slack_webhook_url` | string | ○ | — |
| `slack_attendance_channel` | string | — | `#attendance` |
| `slack_checkout_channel` | string | — | `#attendance` |
| `slack_monthly_confirm_mention` | string | — | `@{user}`（本人メンション用フォーマット） |
| `slack_invoice_dm` | string | — | `dm`（本人DM送信用キーワード） |
| `monthly_closing_notify_day` | integer (1-28) | — | `25` |
| `company_name_parent` | string | — | `ブーストコンサルティング` |
| `company_name_child` | string | — | `SALT2` |
| `internal_settlement_consolidation` | boolean | — | `true`（内部取引相殺ON） |
| `default_paying_company` | string | — | `company_of_member`（所属会社を支払元とする） |

---

## 非機能要件（確定）

| 区分 | 内容 |
|------|------|
| 性能 | 設定保存 API 応答 200ms 以内 |
| セキュリティ | 管理者ロールのみアクセス可（サーバー側でロール検証）。`is_secret = true` の設定値はログに出力しない（マスク処理）。Webhook URL は API レスポンスでもマスク（末尾 8 文字のみ表示）|
| 監査 | 設定変更のたびに `audit_logs` へ「どのキーを・誰が・いつ変更したか（value は secret の場合マスク）」を記録 |
| ログ | Slack 接続テスト失敗のエラー詳細をサーバーログに記録 |
| 可用性 | 設定画面の障害が他モジュールへ影響しないこと |

---

## 運用要件

| 項目 | 内容 |
|------|------|
| バックアップ | `system_configs` テーブルは日次バックアップ対象 |
| データ保持 | 設定変更履歴は `audit_logs` 経由で保持（90日間） |
| 権限運用 | 設定変更は管理者のみ。初期値は DB Seed で投入する |
| シークレット管理 | `is_secret = true` の値はアプリケーション層で AES-256 暗号化して保存 |

---

## 受け入れ条件（確定）

- [ ] 管理者でログインすると設定画面にアクセスできる
- [ ] 管理者以外でアクセスすると 403 が返る
- [ ] Webhook URL を保存すると `system_configs` に反映される
- [ ] Slack 接続テストが成功すると「接続に成功しました」が表示される
- [ ] Slack 接続テストが失敗すると「Slack への接続に失敗しました。URL を確認してください」が表示される
- [ ] 不正な形式の Webhook URL 入力時は「有効な Slack Webhook URL を入力してください」バリデーションが表示される
- [ ] 月末締め通知日に 1〜28 以外の値を入力するとバリデーションエラーが表示される
- [ ] 会社名（親会社）が空の場合バリデーションエラーが表示される
- [ ] 設定変更後に `audit_logs` にレコードが追加されている

---

## エラー定義（確定）

| エラー条件 | HTTPステータス | 表示内容 | ログ |
|-----------|--------------|---------|------|
| Webhook URL 不正形式 | 200 | 「有効な Slack Webhook URL を入力してください」 | — |
| Slack テスト送信失敗 | 200 | 「Slack への接続に失敗しました。URL を確認してください」 | ERROR |
| 必須項目が空 | 200 | 各項目に「入力してください」 | — |
| 月末締め通知日が範囲外 | 200 | 「1〜28 の整数を入力してください」 | — |
| DB 保存失敗 | 500 | 「設定の保存に失敗しました。再度お試しください。」 | ERROR |
| 権限なし | 403 | — | WARN |
