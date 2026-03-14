# 要件定義書（リバースエンジニアリング版）

> **目的**: 既存コードから「今何が実装されているか」を棚卸しし、言語化したもの。
> **対象**: integrated-ops-system（統合業務管理システム）
> **作成日**: 2026-03-14
> **ソース**: 実装コード（src/**, prisma/schema.prisma）

---

## 1. システム概要

### 1-1. 目的

Boost / SALT2 の2社の業務を統合管理するWebアプリケーション。
以下の業務を一元的にカバーする：

- 勤怠管理（打刻・修正・承認・集計）
- 勤務予定・カレンダー
- プロジェクト管理（アサイン・ポジション・工数）
- 請求管理（請求書生成・送付・承認フロー）
- 損益管理（PL・キャッシュフロー）
- メンバー管理（プロフィール・スキル・評価・契約・ツール）
- システム設定

### 1-2. 技術スタック

| 区分 | 技術 |
|------|------|
| フレームワーク | Next.js 14（App Router） |
| 言語 | TypeScript |
| ORM | Prisma |
| DB | PostgreSQL（Supabase） |
| 認証 | iron-session（Cookie ベース） |
| スタイル | Tailwind CSS + shadcn/ui ライクな独自コンポーネント |
| クライアント状態 | SWR（サーバーデータキャッシュ）+ React useState |
| 外部連携 | Slack API（通知）、DocuSign（電子契約） |

### 1-3. 対象ユーザーとロール

| ロール | DB 値 | 対応するステータス | 権限概要 |
|--------|-------|--------------------|----------|
| admin | `admin` | 役員（executive） | 全機能の閲覧・編集・削除。設定変更。 |
| manager | `manager` | 社員（employee） | ほぼ全機能の閲覧・編集。削除は一部制限。 |
| member | `member` | インターン（intern_full, intern_training）、研修生（training_member） | 自分のデータの閲覧・一部入力。 |

---

## 2. 機能一覧

### 2-1. 認証

| 機能 | 説明 | 実装場所 |
|------|------|----------|
| ログイン | メール + パスワードで認証。bcryptjs でハッシュ比較。成功時にセッション Cookie 発行。 | `api/auth/login/route.ts` |
| ログアウト | セッション Cookie を破棄。 | `api/auth/logout/route.ts` |
| セッション確認 | 現在のログインユーザー情報を返す。Edge Runtime で動作。 | `api/auth/session/route.ts` |
| 認証ミドルウェア | Cookie なしのリクエストを `/login` にリダイレクト。`/api/auth/*`, `/_next/` 等は除外。 | `src/middleware.ts` |
| クライアント認証状態 | `AuthProvider` で SWR を使いセッション情報をキャッシュ。`useAuth()` フックで各コンポーネントから利用。 | `src/lib/auth-context.tsx` |

**ログイン後の遷移:**
- admin / manager → `/dashboard`
- member → `/mypage`

---

### 2-2. ダッシュボード

| 機能 | 説明 | アクセス |
|------|------|----------|
| ハブ画面 | 各機能へのナビゲーショングリッド。4カテゴリ（日次・月次・プロジェクト・メンバー）に分類。 | admin, manager |
| リダイレクト | member がアクセスすると `/mypage` にリダイレクト。 | — |

**ナビゲーション項目:**
- 日次: 打刻、カレンダー
- 月次: 請求書管理、PLサマリー、キャッシュフロー、人事評価
- プロジェクト: プロジェクト一覧、工数管理、スキルマトリクス
- メンバー: メンバー管理、ツール関連、契約関連

---

### 2-3. 勤怠管理

#### 2-3-1. 打刻（`/attendance`）

| 機能 | 説明 | アクセス |
|------|------|----------|
| 出勤打刻 | 勤務場所（出社/オンライン）選択 → 今日やること入力 → 出勤記録。楽観的 UI 更新。 | 全ロール |
| 退勤打刻 | 今日やったこと・次回やること・休憩時間を入力 → 退勤記録。実働時間を自動計算。 | 全ロール |
| 今日の勤怠カード | 現在の出退勤状態・時刻をリアルタイム表示。 | 全ロール |
| 修正申請承認 | 修正ステータスが `modified` の勤怠レコードを一覧表示。承認 / 却下ボタン。 | admin, manager |

**ステータス遷移:**
```
not_started → working（出勤時）→ done（退勤時）
                                → absent（管理者による欠勤設定）
```

**確認ステータス遷移:**
```
unconfirmed → confirmed（管理者承認）
            → approved（最終承認）
            → rejected（却下）
```

#### 2-3-2. 勤怠一覧（`/attendance/list`）

| 機能 | 説明 | アクセス |
|------|------|----------|
| 月別一覧 | メンバー × 月で勤怠レコードを表示。50件ずつ Load More。 | 全ロール（admin は全員分） |
| サマリーカード | 稼働日数・合計実働時間・欠勤/休暇日数を表示。 | 全ロール |
| インライン編集 | 出勤・退勤・休憩時間を行内で編集可能。保存で `status: modified` に変更。 | 全ロール（自分の分） |
| 新規勤怠登録 | 日付・出勤・退勤・休憩を入力して手動登録。 | 全ロール |
| 承認 / 却下 | `modified` ステータスの行に承認・却下ボタン表示。 | admin, manager |
| CSV エクスポート | UTF-8 BOM 付きの CSV をダウンロード。 | 全ロール |
| メンバー切替 | admin/manager はドロップダウンで対象メンバーを切替。 | admin, manager |

---

### 2-4. 勤務予定（`/schedule`）

| 機能 | 説明 | アクセス |
|------|------|----------|
| 翌週予定入力 | 月〜日の7日分の勤務予定を入力。各日に出社/オンライン、開始/終了時刻を設定。 | 全ロール |
| 終日休み | チェックボックスで終日休みに設定。 | 全ロール |
| 前週コピー | 前週のデフォルト値（9:30-18:30）をコピー。 | 全ロール |
| 未提出アラート | 翌週の勤務予定未登録メンバーを表示。 | admin, manager |

---

### 2-5. カレンダー（`/calendar`）

| 機能 | 説明 | アクセス |
|------|------|----------|
| 週表示 | 7日×24時間のタイムグリッド。出勤ブロック（実績）と予定ブロック（計画）を重ね表示。 | 全ロール |
| 月表示 | カレンダーグリッド。1セル最大3件+残数表示。 | 全ロール |
| プロジェクトフィルタ | プロジェクトボタンで表示対象を絞り込み。 | 全ロール |
| メンバーフィルタ | 個別メンバーの表示/非表示トグル。 | 全ロール |
| 現在時刻線 | 赤い線で現在時刻を表示。1分ごとに更新。 | — |
| メンバー色分け | 8色を循環割り当て。凡例表示あり。 | — |
| 表示制御 | admin は全メンバー表示、member は自分のみ（デフォルト）。 | — |

---

### 2-6. プロジェクト管理

#### 2-6-1. プロジェクト一覧（`/projects`）

| 機能 | 説明 | アクセス |
|------|------|----------|
| 一覧表示 | 全プロジェクトをカード/リスト表示。ステータスバッジ付き。 | 全ロール（閲覧） |
| 新規作成 | 名前、会社、ステータス、期間、クライアント、契約種別、月額を入力。 | admin, manager |
| 詳細遷移 | クリックで詳細ページへ。 | 全ロール |

#### 2-6-2. プロジェクト詳細（`/projects/[id]`）

| 機能 | 説明 | アクセス |
|------|------|----------|
| プロジェクト情報表示 | 名前、会社、ステータス、期間、クライアント、月額、契約種別、説明。 | 全ロール |
| プロジェクト編集 | 全フィールドの編集。インライン編集モード。 | admin, manager |
| プロジェクト削除 | 確認モーダル付き。 | admin |
| ポジション表示 | ポジション名、必要人数、現在の充足状態をカード表示。 | 全ロール |
| アサイン一覧 | メンバー名、ポジション、月間工数、開始日を表示。 | 全ロール |
| アサイン追加 | メンバー、ポジション（既存選択 or 新規入力）、工数、開始日を入力。モーダル。 | admin, manager |
| アサイン削除 | テーブルの行から削除。 | admin, manager |

#### 2-6-3. ポジション管理

| 機能 | 説明 |
|------|------|
| ポジション作成 | プロジェクト新規作成時にポジション名 + 必要人数を定義。 |
| 必要スキル紐付け | PositionRequiredSkill モデルで最低スキルレベルを定義（DB 上のみ、UI 未実装）。 |

---

### 2-7. 工数管理（`/workload`）

| 機能 | 説明 | アクセス |
|------|------|----------|
| マトリクス表示 | 行=メンバー、列=プロジェクト。セルに月間工数（時間）を表示。 | admin, manager |
| 月選択 | 過去6ヶ月から選択。 | admin, manager |
| 編集モード | セルをクリックして工数を編集。変更分のみ一括保存。 | admin, manager |
| 行/列合計 | メンバーごと・プロジェクトごとの合計工数。 | — |

---

### 2-8. 請求管理（`/closing`）

#### 管理者ビュー（AdminClosingView）

| 機能 | 説明 | アクセス |
|------|------|----------|
| メンバー別締めテーブル | 契約種別、給与種別、稼働日数、合計時間、不足日数、見込金額、確認状態、請求書状態。 | admin, manager |
| 月次サマリー | 月選択、合計見込金額、メンバー数。 | admin, manager |
| 確認ステータス管理 | メンバーの勤怠を「確認」→「承認」フローで管理。Slack DM 通知。強制確認。 | admin, manager |
| 請求書生成 | POST `/api/invoices/generate` で一括生成。 | admin |
| 請求書詳細モーダル | 明細行（品名、金額、課税）の追加・削除・編集。税込/税抜/経費の自動計算。 | admin, manager |
| 請求書削除 | 確認後に削除。 | admin |

#### メンバービュー（MemberBillingView）

| 機能 | 説明 | アクセス |
|------|------|----------|
| 自分の請求情報 | 月選択 → 自分の勤怠サマリー + 請求書閲覧。 | member |
| 月次工数自己申告 | プロジェクトごとの配分（%）を入力。合計100%バリデーション。カスタム項目追加可。 | member |
| 請求書明細閲覧 | 明細の閲覧のみ（編集不可）。 | member |

#### 月次工数自己申告（SelfReportCard）

| 機能 | 説明 |
|------|------|
| プロジェクト配分入力 | アサイン済みプロジェクトを初期表示。各行に配分 % を入力。 |
| プロジェクト追加 | 未追加のプロジェクトをドロップダウンから選択。 |
| カスタム項目追加 | 自由テキストで「社内業務」等の非プロジェクト作業を追加。 |
| 合計バリデーション | 合計が100%でないと申告不可。 |
| 申告済み表示 | 申告完了後は読み取り専用テーブル + 「修正する」ボタン。 |

---

### 2-9. 請求書管理

| 機能 | 説明 | アクセス |
|------|------|----------|
| 請求書生成 | メンバーの勤怠・単価・アサインから請求書を自動生成。請求番号を自動採番。 | admin |
| 明細行管理 | 品名、金額、課税/非課税、並び順を管理。追加・編集・削除。 | admin, manager |
| 金額計算 | 課税合計 × 1.1 = 税込、非課税経費は別計上。 | — |
| ステータス管理 | unsent → sent → confirmed の3段階。 | admin, manager |
| Boost/SALT2 配分 | `amountBoost`, `amountSalt2` フィールドで2社への配分を管理。 | admin |

---

### 2-10. 損益管理（PL）

#### 2-10-1. PLサマリー（`/pl/summary`）

| 機能 | 説明 | アクセス |
|------|------|----------|
| 会社別タブ | 合算 / Boost / SALT2 で表示切替。 | admin, manager |
| 月選択 | 過去6ヶ月から選択。 | admin, manager |
| PLテーブル | プロジェクトごとの売上（契約+追加）、人件費、ツール費、その他、粗利、粗利率。 | admin, manager |
| マークアップ率編集 | dispatch プロジェクトのマークアップ率を入力。 | admin |
| PL チャート | 売上 vs 費用の棒グラフ。月次推移の折れ線グラフ。 | admin, manager |
| 自己申告状態 | メンバーの月次申告提出状態（済/未）を表示。 | admin |

#### 2-10-2. プロジェクト別PL（`/pl/project`）

| 機能 | 説明 | アクセス |
|------|------|----------|
| プロジェクト選択 | サイドバーからプロジェクトを選択。 | admin, manager |
| PL指標 | 売上、人件費、ツール費、その他、粗利、粗利率、マークアップ率を表示。 | admin, manager |
| 編集 | マークアップ率、追加売上、その他費用を編集。 | admin |
| エリアチャート | 売上/費用の推移をエリアチャートで表示。 | admin, manager |

#### 2-10-3. キャッシュフロー（`/pl/cashflow`）

| 機能 | 説明 | アクセス |
|------|------|----------|
| 会社別タブ | Boost / SALT2 で表示切替。 | admin |
| 月選択 | 過去6ヶ月。 | admin |
| CF入力 | 期首残高、入金（顧客/その他）、出金（給与/固定費/経費/その他）を編集。 | admin |
| 自動取得 | 入金(顧客)、出金(給与/固定費/経費)は請求書・メンバー・ツールから自動計算。 | — |
| 残高計算 | 期末残高 = 期首 + 入金合計 - 出金合計（自動計算）。 | — |
| トレンドチャート | 月次 CF 推移をチャート表示。 | admin |

---

### 2-11. PL レコード生成（`/api/pl-records/generate`）

| 機能 | 説明 |
|------|------|
| 月次 PL 一括生成 | 対象月のアサイン・自己申告・勤怠サマリー・ツールコストから PL レコードを自動生成。 |
| 売上計算 | `revenueContract` = プロジェクトの `monthlyContractAmount`。 |
| 人件費計算 | 月給制: `salaryAmount × (reportedHours / memberTotalHours)`。時給制: `salaryAmount × reportedHours`。 |
| ツール費配分 | メンバーのツール月額合計を、各プロジェクトの申告時間比率で按分。 |
| 粗利計算 | `grossProfit = revenue - labor - tools - other`。粗利率 = `grossProfit / revenue`。 |
| Upsert | 既存レコードがあれば更新、なければ作成。 |

---

### 2-12. メンバー管理

#### 2-12-1. メンバー一覧（`/members`）

| 機能 | 説明 | アクセス |
|------|------|----------|
| 一覧表示 | 全メンバーをカード/リスト表示。検索・ロールフィルタ。 | admin, manager（閲覧）、member（閲覧のみ） |
| 新規作成リンク | `/members/new` へ遷移。 | admin, manager |

#### 2-12-2. メンバー新規作成（`/members/new`）

| 機能 | 説明 | アクセス |
|------|------|----------|
| プロフィール入力 | 名前、メール、パスワード、電話、ステータス、給与種別、給与額、入社日。 | admin, manager |
| ロール自動設定 | ステータスから自動推定（executive→admin, employee→manager, 他→member）。 | — |
| UserAccount 同時作成 | Member + UserAccount をトランザクションで作成。 | — |

#### 2-12-3. メンバー詳細（`/members/[id]`）

| 機能 | 説明 | アクセス |
|------|------|----------|
| プロフィール表示 | 名前、メール、電話、住所、入社日、ステータス、ロール、給与情報。 | 全ロール（自分 or 管理者） |
| プロフィール編集 | モーダルで名前・メール・電話・住所・ステータス・給与・入社日を編集。 | admin, manager |
| メンバー削除 | 確認モーダル。ソフトデリート（`deletedAt` 設定）。 | admin |
| スキルタブ | 評価済みスキル一覧（カテゴリ、スキル名、レベル、メモ、評価日）。 | 全ロール |
| ツールタブ | 割当ツール一覧（名前、プラン、月額、メモ）。追加・編集・削除。 | admin, manager |
| 契約タブ | 契約一覧（テンプレート名、期間、ステータス）。 | admin, manager |
| 銀行口座情報 | 銀行名、支店、口座番号、口座名義。編集可能。 | 全ロール（自分の分） |

---

### 2-13. マイページ（`/mypage`）

| 機能 | 説明 | アクセス |
|------|------|----------|
| プロフィールカード | アバター、名前、ロール、メール、電話、入社日、給与種別。編集ボタン。 | 全ロール |
| 銀行口座カード | 口座情報表示。未入力時に警告。 | 全ロール |
| 今日の勤怠カード | 出退勤時刻、休憩時間を表示（memo コンポーネント）。 | 全ロール |
| スキル一覧 | 評価済みスキルをレベルバー付きで表示。 | 全ロール |
| 人事評価一覧 | 月別の P/A/S スコア、平均、コメントをテーブル表示。 | 全ロール |
| 担当プロジェクト | アサイン済みプロジェクト一覧（ロール、工数）。 | 全ロール |
| クイックリンク | 勤怠一覧→`/attendance/list`、月次申告→`/closing`。 | 全ロール |
| パスワード変更 | 現在のパスワード + 新パスワード（確認付き）。8文字以上バリデーション。 | 全ロール |
| 通知設定 | Slack / メール通知の設定（準備中と表示）。 | 全ロール |

---

### 2-14. スキル管理

#### 2-14-1. スキルマトリクス（`/skills`）

| 機能 | 説明 | アクセス |
|------|------|----------|
| マトリクス表示 | 行=メンバー、列=スキル。セルにレベル（0-5）をバッジ色で表示。 | 全ロール |
| カテゴリフィルタ | ドロップダウンでスキルカテゴリを絞り込み。 | 全ロール |
| 最低レベルフィルタ | スライダーで最低レベルを設定。 | 全ロール |
| ページネーション | 20メンバーずつ表示。Load More。 | — |
| 評価リンク | メンバー行から個別評価ページへ遷移。 | admin, manager |

#### 2-14-2. スキル設定（`/skills/settings`）

| 機能 | 説明 | アクセス |
|------|------|----------|
| カテゴリ管理 | 追加・編集・削除。表示順管理。 | admin |
| スキル管理 | カテゴリ配下にスキルを追加・編集・削除。表示順管理。 | admin |

#### 2-14-3. 個別スキル評価（`/skills/evaluation/[memberId]`）

| 機能 | 説明 | アクセス |
|------|------|----------|
| メンバー情報ヘッダー | 対象メンバーの名前・会社・ステータス。 | admin, manager |
| カテゴリ別アコーディオン | スキルをカテゴリごとに展開/折りたたみ。 | admin, manager |
| スキル評価フォーム | レベル（1-5 ボタン選択）、メモ入力。スキルごとに保存。 | admin, manager |

---

### 2-15. 人事評価（`/evaluation`）

| 機能 | 説明 | アクセス |
|------|------|----------|
| 月選択 | 12ヶ月ドロップダウン。 | admin, manager |
| メンバーグリッド | カード表示。評価済みマーク（✓）付き。 | admin, manager |
| 評価モーダル | P（Professional）/ A（Appearance）/ S（Skill）の3指標を5段階評価。コメント入力。 | admin, manager |
| 評価ラベル | 1=要改善、2=普通以下、3=標準、4=優秀、5=卓越。 | — |

---

### 2-16. ツール管理（`/tools`）

| 機能 | 説明 | アクセス |
|------|------|----------|
| ツール一覧 | 全メンバーのツール（SaaS等）をテーブル表示。メンバー/ツール名でフィルタ。 | admin, manager |
| サマリーカード | ツールごとのライセンス数・月額合計。 | admin, manager |
| ツール追加 | メンバー選択、ツール名、プラン、月額、メモを入力。 | admin, manager |
| ツール編集 | プラン、月額、メモを更新。 | admin, manager |
| ツール削除 | 確認後に削除。 | admin, manager |

---

### 2-17. 契約管理（`/contracts`）

| 機能 | 説明 | アクセス |
|------|------|----------|
| 契約一覧 | 全メンバーの契約をテーブル表示。ステータスフロー表示。 | admin, manager |
| 契約作成 | メンバー選択、テンプレート選択（DocuSign）、開始日、終了日。 | admin, manager |
| ステータスフロー | draft → sent → waiting_sign → completed / voided のビジュアルパイプライン。 | — |
| 署名送付 | DocuSign API で電子署名依頼を送信。 | admin, manager |
| PDF ダウンロード | 署名済み契約書の PDF をダウンロード。 | admin, manager |
| 契約無効化 | ステータスを `voided` に変更。 | admin, manager |
| Webhook | DocuSign からの署名完了通知を受信し、ステータス自動更新。 | システム |

---

### 2-18. システム設定（`/settings`）

| 機能 | 説明 | アクセス |
|------|------|----------|
| Slack 連携 | 月末締め通知日（1-28日）設定。Slack 接続テスト。 | admin |
| 会社情報 | 親会社名、子会社名、会計年度開始月、残業判定時間。 | admin |
| システム情報 | アプリ名、バージョン、フレームワーク等の読み取り専用表示。 | admin |

---

### 2-19. Cron ジョブ

| 機能 | 説明 | 実装場所 |
|------|------|----------|
| 週次勤務予定リマインダー | 翌週の勤務予定未登録メンバーに Slack 通知。`CRON_SECRET` で認証。 | `api/cron/weekly-schedule-reminder/route.ts` |

---

### 2-20. Slack 連携

| 機能 | 説明 |
|------|------|
| DM 送信 | メンバーのメールから Slack ユーザーを逆引きし、DM 送信。 |
| メンション取得 | メンバーの Slack ID を取得。 |
| 接続テスト | `auth.test` API で接続確認。 |

---

## 3. 非機能要件（実装から読み取れるもの）

### 3-1. パフォーマンス

| 項目 | 実装 |
|------|------|
| SWR キャッシュ | 全 API フェッチを SWR でキャッシュ。`dedupingInterval` でリクエスト重複排除。 |
| SWR Provider | ルートレイアウトに `SWRProvider` 配置。アプリ全体でキャッシュ共有。 |
| 楽観的更新 | 出退勤で `mutate` を使い API 完了前に UI 更新。 |
| useMemo 最適化 | カレンダー色マップ、締め集計、スキル統計を事前計算。 |
| React.memo | TodayAttendanceCard, ClosingTableRow 等のサブコンポーネント。 |
| ページネーション | 勤怠一覧: 50件ずつ、スキルマトリクス: 20件ずつ。 |
| 月次サマリーテーブル | `MonthlyAttendanceSummary` で勤怠集計を非正規化。 |

### 3-2. セキュリティ

| 項目 | 実装 |
|------|------|
| パスワードハッシュ | bcryptjs で saltRounds=10。 |
| セッション管理 | iron-session で Cookie 暗号化。 |
| CSRF 保護 | SameSite Cookie 属性。 |
| 認証ミドルウェア | 全ルートに Cookie チェック（public パス除外）。 |
| ロールベース認可 | API ルートで `session.user.role` を検証。 |
| ソフトデリート | Member, Project は `deletedAt` で論理削除。 |
| 監査ログ | AuditLog モデルで操作履歴を記録（一部 API のみ）。 |

### 3-3. 外部連携

| サービス | 用途 | 実装状況 |
|----------|------|----------|
| Slack | 締め通知 DM、勤務予定リマインダー | 実装済み（`SLACK_BOT_TOKEN` 必要） |
| DocuSign | 電子契約の送付・署名・ダウンロード | 実装済み（`DOCUSIGN_*` 環境変数必要） |
| Supabase | PostgreSQL ホスティング | 利用中 |

---

## 4. 画面遷移図

```
/login
  ↓ (ログイン成功)
  ├─ admin/manager → /dashboard
  │    ├── /attendance (打刻)
  │    ├── /attendance/list (勤怠一覧)
  │    ├── /calendar (カレンダー)
  │    ├── /schedule (勤務予定)
  │    ├── /closing (請求管理)
  │    ├── /pl/summary (PLサマリー)
  │    ├── /pl/project (プロジェクト別PL)
  │    ├── /pl/cashflow (キャッシュフロー)
  │    ├── /evaluation (人事評価)
  │    ├── /projects (プロジェクト一覧)
  │    │    ├── /projects/new (新規作成)
  │    │    └── /projects/[id] (詳細)
  │    │         └── /projects/[id]/assign (アサイン)
  │    ├── /workload (工数マトリクス)
  │    ├── /skills (スキルマトリクス)
  │    │    ├── /skills/settings (スキル設定)
  │    │    └── /skills/evaluation/[memberId] (個別評価)
  │    ├── /members (メンバー一覧)
  │    │    ├── /members/new (新規作成)
  │    │    └── /members/[id] (詳細)
  │    ├── /tools (ツール管理)
  │    ├── /contracts (契約管理)
  │    ├── /settings (システム設定)
  │    └── /mypage (マイページ)
  │
  └─ member → /mypage
       ├── /attendance (打刻)
       ├── /attendance/list (勤怠一覧: 自分のみ)
       ├── /calendar (カレンダー: 自分のみ)
       ├── /schedule (勤務予定)
       └── /closing (請求管理: 自分のみ + 月次申告)
```

---

## 5. API 一覧

### 認証

| メソッド | パス | 概要 |
|----------|------|------|
| POST | `/api/auth/login` | ログイン |
| POST | `/api/auth/logout` | ログアウト |
| GET | `/api/auth/session` | セッション確認 |

### 勤怠

| メソッド | パス | 概要 |
|----------|------|------|
| GET | `/api/attendances` | 月別勤怠一覧 |
| POST | `/api/attendances` | 新規勤怠登録 |
| GET | `/api/attendances/today` | 今日の勤怠 |
| POST | `/api/attendances/clock-in` | 出勤打刻 |
| POST | `/api/attendances/clock-out` | 退勤打刻 |
| PUT | `/api/attendances/[id]` | 勤怠編集 |
| PATCH | `/api/attendances/[id]` | 勤怠承認/却下 |
| GET | `/api/attendances/corrections` | 修正待ち一覧 |
| GET | `/api/attendances/summary` | 月次サマリー |

### メンバー

| メソッド | パス | 概要 |
|----------|------|------|
| GET | `/api/members` | メンバー一覧 |
| POST | `/api/members` | メンバー作成 |
| GET | `/api/members/[id]` | メンバー詳細 |
| PATCH | `/api/members/[id]` | メンバー更新 |
| DELETE | `/api/members/[id]` | メンバー削除 |
| GET | `/api/members/[id]/skills` | スキル一覧 |
| POST | `/api/members/[id]/skills` | スキル評価登録 |
| GET | `/api/members/[id]/tools` | ツール一覧 |
| POST | `/api/members/[id]/tools` | ツール追加 |
| PUT | `/api/members/[id]/tools/[toolId]` | ツール更新 |
| DELETE | `/api/members/[id]/tools/[toolId]` | ツール削除 |
| GET | `/api/members/[id]/contracts` | 契約一覧 |
| POST | `/api/members/[id]/contracts` | 契約作成 |
| PUT | `/api/members/[id]/contracts/[cId]` | 契約更新 |
| DELETE | `/api/members/[id]/contracts/[cId]` | 契約削除 |
| POST | `/api/members/[id]/contracts/[cId]/send` | 署名依頼送信 |
| GET | `/api/members/[id]/contracts/[cId]/download-url` | PDF URL取得 |
| PATCH | `/api/members/[id]/contracts/[cId]/void` | 契約無効化 |
| PATCH | `/api/members/[id]/profile` | プロフィール更新 |
| POST | `/api/members/[id]/profile/password` | パスワード変更 |
| GET | `/api/members/[id]/work-schedules` | 勤務予定取得 |
| POST | `/api/members/[id]/work-schedules` | 勤務予定登録 |

### プロジェクト

| メソッド | パス | 概要 |
|----------|------|------|
| GET | `/api/projects` | プロジェクト一覧 |
| POST | `/api/projects` | プロジェクト作成 |
| GET | `/api/projects/[id]` | プロジェクト詳細 |
| PUT | `/api/projects/[id]` | プロジェクト更新 |
| DELETE | `/api/projects/[id]` | プロジェクト削除 |
| GET | `/api/projects/[id]/positions` | ポジション一覧 |
| POST | `/api/projects/[id]/positions` | ポジション作成 |
| GET | `/api/projects/[id]/assignments` | アサイン一覧 |
| POST | `/api/projects/[id]/assignments` | アサイン追加 |
| PATCH | `/api/projects/[id]/assignments/[aId]` | アサイン更新 |
| DELETE | `/api/projects/[id]/assignments/[aId]` | アサイン削除 |

### 請求・締め

| メソッド | パス | 概要 |
|----------|------|------|
| GET | `/api/closing` | 月次締めデータ |
| GET | `/api/closing/members/[id]` | メンバー締め詳細 |
| PATCH | `/api/closing/members/[id]` | 確認ステータス更新 |
| PATCH | `/api/closing/members/[id]/notify` | Slack 通知送信 |
| PATCH | `/api/closing/members/[id]/force-confirm` | 強制確認 |
| GET | `/api/invoices` | 請求書一覧 |
| POST | `/api/invoices` | 請求書作成 |
| PUT | `/api/invoices/[id]` | 請求書更新 |
| DELETE | `/api/invoices/[id]` | 請求書削除 |
| POST | `/api/invoices/generate` | 請求書一括生成 |
| POST | `/api/invoices/[id]/items` | 明細行追加 |
| DELETE | `/api/invoices/[id]/items/[itemId]` | 明細行削除 |

### PL・キャッシュフロー

| メソッド | パス | 概要 |
|----------|------|------|
| GET | `/api/pl-records` | PL レコード一覧 |
| POST | `/api/pl-records/generate` | PL レコード一括生成 |
| PATCH | `/api/pl-records/[id]` | PL レコード更新 |
| GET | `/api/cashflow` | キャッシュフロー取得 |
| PUT | `/api/cashflow` | キャッシュフロー更新 |

### スキル

| メソッド | パス | 概要 |
|----------|------|------|
| GET | `/api/skill-categories` | カテゴリ一覧 |
| POST | `/api/skill-categories` | カテゴリ作成 |
| PUT | `/api/skill-categories/[id]` | カテゴリ更新 |
| DELETE | `/api/skill-categories/[id]` | カテゴリ削除 |
| GET | `/api/skill-categories/[id]/skills` | スキル一覧 |
| POST | `/api/skill-categories/[id]/skills` | スキル作成 |
| PUT | `/api/skill-categories/[id]/skills/[sId]` | スキル更新 |
| DELETE | `/api/skill-categories/[id]/skills/[sId]` | スキル削除 |
| GET | `/api/skill-matrix` | スキルマトリクスデータ |

### 評価

| メソッド | パス | 概要 |
|----------|------|------|
| GET | `/api/evaluations` | 月次評価一覧 |
| POST | `/api/evaluations` | 評価登録 |

### 自己申告

| メソッド | パス | 概要 |
|----------|------|------|
| GET | `/api/self-reports` | 自己申告一覧 |
| POST | `/api/self-reports` | 自己申告登録 |

### その他

| メソッド | パス | 概要 |
|----------|------|------|
| GET | `/api/mypage-summary` | マイページ用データ |
| GET | `/api/dashboard` | ダッシュボード用データ |
| GET | `/api/calendar` | カレンダー用データ |
| GET | `/api/workload` | 工数マトリクスデータ |
| GET | `/api/system-configs` | システム設定取得 |
| PUT | `/api/system-configs` | システム設定更新 |
| POST | `/api/slack/test` | Slack 接続テスト |
| GET | `/api/contracts/templates` | DocuSign テンプレート |
| POST | `/api/webhooks/docusign` | DocuSign Webhook |
| GET | `/api/cron/weekly-schedule-reminder` | 週次リマインダー |
| GET | `/api/tools` | ツール全件取得 |
