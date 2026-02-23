# API設計書

> 作成日: 2026-02-20
> 参照: docs/requirements/requirements-v2/*.md / docs/requirements/database/database-design.md

---

## 目次

1. [API基本設計](#1-api基本設計)
2. [認証・認可](#2-認証認可)
3. [共通エラー設計](#3-共通エラー設計)
4. [エンドポイント一覧](#4-エンドポイント一覧)
5. [API詳細: 認証（C-01）](#5-api詳細-認証c-01)
6. [API詳細: ダッシュボード（C-02）](#6-api詳細-ダッシュボードc-02)
7. [API詳細: 設定（C-03）](#7-api詳細-設定c-03)
8. [API詳細: メンバー（M1）](#8-api詳細-メンバーm1)
9. [API詳細: スキル（M2）](#9-api詳細-スキルm2)
10. [API詳細: プロジェクト（M3）](#10-api詳細-プロジェクトm3)
11. [API詳細: 勤怠（M4）](#11-api詳細-勤怠m4)
12. [API詳細: 請求（M5）](#12-api詳細-請求m5)
13. [API詳細: PL・CF（M6）](#13-api詳細-plcfm6)
14. [ページ↔API対応表](#14-ページapi対応表)
15. [監査ログ・トレーシング方針](#15-監査ログトレーシング方針)

---

## 1. API基本設計

| 項目 | 内容 |
|------|------|
| ベースURL | `/api` (Next.js App Router: `src/app/api/`) |
| プロトコル | HTTPS 必須 |
| データ形式 | JSON (`Content-Type: application/json`) |
| 文字コード | UTF-8 |
| 日付形式 | ISO 8601 (`2026-02-20`, `2026-02-20T10:00:00+09:00`) |
| 金額 | INTEGER（円単位、消費税は別途計算） |
| ページネーション | `?page=1&limit=50`（最大 200） |
| 権限制御 | 共通UIを前提に、各APIは permission flags を返す（例: `canView`, `canEdit`, `canApprove`, `canDownload`, `canSendSlack`）。サーバー側でも必ずロール/RLSチェックを実施し、フロントは同一画面のボタン活性/表示のみ切替で対応する |

### レスポンス共通構造

```json
// 成功
{
  "data": { ... } | [ ... ],
  "meta": { "total": 100, "page": 1, "limit": 50 }   // 一覧の場合
}

// エラー
{
  "error": {
    "code": "ERROR_CODE",
    "message": "ユーザー向けメッセージ",
    "details": [ { "field": "email", "message": "..." } ]  // バリデーション時
  }
}
```

---

## 2. 認証・認可

### 認証方式

**メールアドレス + パスワード認証**。`iron-session` または NextAuth.js Credentials Provider を使用。Cookie ベースのセッション認証。

```
Cookie: session=<encrypted-session>  // HttpOnly / Secure / SameSite=Lax
```

パスワードは **bcrypt（コスト 12）** でハッシュ化して `user_accounts.password_hash` に保存。

セッションペイロード:
```json
{
  "user": {
    "id": "uuid",          // user_accounts.id
    "memberId": "uuid",    // members.id
    "email": "...",
    "role": "admin | manager | employee | intern"
  },
  "expires": "2026-02-21T10:00:00Z"
}
```

### ロール権限マトリクス

| ロール | 説明 |
|--------|------|
| `admin` | 全機能アクセス可 |
| `manager` | 全メンバーの基本情報（スケジュール・スキル・配属PJ）閲覧・担当PJ管理・担当PJメンバーの勤怠承認 |
| `employee` | 全メンバーの基本情報（スケジュール・スキル・配属PJ）閲覧・自分の詳細情報閲覧・打刻・請求書確認 |
| `intern` | 全メンバーの基本情報（スケジュール・スキル・配属PJ）閲覧・自分の詳細情報閲覧・打刻・請求書確認 |

### API 認可ルール（サーバー側で必ず検証）

| パターン | 説明 |
|---------|------|
| `requireAuth()` | ログイン必須（全ロール） |
| `requireRole('admin')` | admin のみ |
| `requireRole('admin', 'manager')` | admin または manager |
| `requireSelfOrAdmin(memberId)` | 本人または admin |
| `requireManagerOf(projectId)` | admin または担当マネージャー |

---

## 3. 共通エラー設計

### HTTPステータスコード

| コード | 意味 | 使用場面 |
|--------|------|---------|
| 200 | OK | 成功（GET/PUT） |
| 201 | Created | 作成成功（POST） |
| 204 | No Content | 削除成功（DELETE） |
| 400 | Bad Request | バリデーションエラー |
| 401 | Unauthorized | 未認証（セッション切れ含む） |
| 403 | Forbidden | 権限不足 |
| 404 | Not Found | リソース未存在 |
| 409 | Conflict | 重複エラー（メール重複、二重打刻等） |
| 500 | Internal Server Error | サーバーエラー |

### エラーコード定義

| code | HTTP | 説明 |
|------|------|------|
| `UNAUTHORIZED` | 401 | 未認証 |
| `FORBIDDEN` | 403 | 権限不足 |
| `NOT_FOUND` | 404 | リソース未存在 |
| `VALIDATION_ERROR` | 400 | バリデーションエラー（details に詳細） |
| `CONFLICT` | 409 | 重複エラー |
| `INTERNAL_ERROR` | 500 | サーバー内部エラー |

### バリデーションエラー例

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "入力内容に誤りがあります",
    "details": [
      { "field": "email", "message": "このメールアドレスはすでに登録されています" },
      { "field": "left_at", "message": "退社日は入社日以降に設定してください" }
    ]
  }
}
```

---

## 4. エンドポイント一覧

| # | Method | Path | 概要 | 認可 |
|---|--------|------|------|------|
| **認証** |
| A-1 | POST | `/api/auth/login` | ログイン（メール+PW） | public |
| A-2 | POST | `/api/auth/logout` | ログアウト | requireAuth |
| A-3 | GET | `/api/auth/session` | セッション情報取得 | requireAuth |
| **マイページ（C-04）** |
| MY-1 | PUT | `/api/me/email` | メールアドレス変更 | requireAuth |
| MY-2 | PUT | `/api/me/password` | パスワード変更 | requireAuth |
| MY-3 | PUT | `/api/admin/users/:id/password` | パスワードリセット（管理者用） | admin |
| **ダッシュボード** |
| D-1 | GET | `/api/dashboard` | ダッシュボード集計データ | requireAuth |
| **設定** |
| S-1 | GET | `/api/settings` | 設定一覧取得 | admin |
| S-2 | PUT | `/api/settings` | 設定更新 | admin |
| S-3 | POST | `/api/settings/slack/test` | Slack疎通テスト | admin |
| **メンバー** |
| M-1 | GET | `/api/members` | メンバー一覧 | requireAuth |
| M-2 | POST | `/api/members` | メンバー新規作成 | admin |
| M-3 | GET | `/api/members/:id` | メンバー詳細（週間スケジュール含む） | requireAuth（フィールドはロール別制御） |
| M-4 | PUT | `/api/members/:id` | メンバー更新 | admin/self |
| M-5 | DELETE | `/api/members/:id` | メンバー論理削除 | admin |
| **メンバーツール（M1-04）** |
| MT-1 | GET | `/api/members/:id/tools` | ツール一覧取得 | admin/self |
| MT-2 | POST | `/api/members/:id/tools` | ツール追加 | admin |
| MT-3 | PUT | `/api/members/:id/tools/:toolId` | ツール更新 | admin |
| MT-4 | DELETE | `/api/members/:id/tools/:toolId` | ツール削除 | admin |
| **メンバー契約書（M1-05）** |
| MC-1 | GET | `/api/members/:id/contracts` | 契約書一覧取得 | admin/self |
| MC-2 | POST | `/api/members/:id/contracts` | 契約書作成（下書き） | admin |
| MC-3 | POST | `/api/members/:id/contracts/:cId/send` | 署名依頼送信（DocuSign） | admin |
| MC-4 | PUT | `/api/members/:id/contracts/:cId/void` | 契約書無効化 | admin |
| MC-5 | GET | `/api/members/:id/contracts/:cId/download-url` | 署名済みPDF URL取得 | admin/self |
| MC-6 | POST | `/api/webhooks/docusign` | DocuSign Webhook受信 | 署名検証のみ |
| **スキル設定** |
| SK-1 | GET | `/api/skill-categories` | カテゴリ一覧 | requireAuth |
| SK-2 | POST | `/api/skill-categories` | カテゴリ作成 | admin |
| SK-3 | PUT | `/api/skill-categories/:id` | カテゴリ更新 | admin |
| SK-4 | DELETE | `/api/skill-categories/:id` | カテゴリ削除 | admin |
| SK-5 | PUT | `/api/skill-categories/reorder` | カテゴリ並べ替え | admin |
| SK-6 | GET | `/api/skills` | スキル一覧 | requireAuth |
| SK-7 | POST | `/api/skills` | スキル作成 | admin |
| SK-8 | PUT | `/api/skills/:id` | スキル更新 | admin |
| SK-9 | DELETE | `/api/skills/:id` | スキル削除 | admin |
| SK-10 | PUT | `/api/skills/reorder` | スキル並べ替え | admin |
| **スキルマトリクス・評価** |
| SE-1 | GET | `/api/skill-matrix` | スキルマトリクス取得 | requireAuth |
| SE-2 | GET | `/api/members/:id/skills` | メンバーのスキル評価一覧 | requireAuth |
| SE-3 | POST | `/api/members/:id/skills` | スキル評価追加 | admin/manager |
| **プロジェクト** |
| P-1 | GET | `/api/projects` | PJ一覧 | requireAuth |
| P-2 | POST | `/api/projects` | PJ作成 | admin/manager |
| P-3 | GET | `/api/projects/:id` | PJ詳細 | requireAuth |
| P-4 | PUT | `/api/projects/:id` | PJ更新 | admin/manager |
| P-5 | DELETE | `/api/projects/:id` | PJ論理削除 | admin |
| P-6 | GET | `/api/projects/:id/assignments` | アサイン一覧 | admin/manager |
| P-7 | POST | `/api/projects/:id/assignments` | アサイン登録 | admin/manager |
| P-8 | PUT | `/api/projects/:id/assignments/:aId` | アサイン更新 | admin/manager |
| P-9 | GET | `/api/workload` | 工数マトリクス取得 | admin/manager |
| P-10 | PUT | `/api/workload` | 工数一括更新 | admin/manager |
| **月次自己申告（C-04）** |
| SR-1 | GET | `/api/me/self-reports` | 自分の月次自己申告一覧取得 | requireAuth |
| SR-2 | PUT | `/api/me/self-reports` | 月次自己申告登録・更新（UPSERT） | requireAuth |
| **勤務予定** |
| WS-1 | GET | `/api/members/:id/work-schedules` | 勤務予定取得 | requireAuth |
| WS-2 | PUT | `/api/members/:id/work-schedules` | 勤務予定登録（週次UPSERT）| admin/self |
| **カレンダー** |
| CA-1 | GET | `/api/calendar` | カレンダーデータ取得 | requireAuth |
| **勤怠** |
| AT-1 | GET | `/api/attendances` | 勤怠一覧 | requireAuth |
| AT-2 | POST | `/api/attendances/clock-in` | 出勤打刻 | requireAuth |
| AT-3 | POST | `/api/attendances/clock-out` | 退勤打刻（bodyに `projectAllocations[{projectId, minutesOrPercent}]`、合計=実働をサーバ検証。自動初期値なし） | requireAuth |
| AT-4 | GET | `/api/attendances/:id` | 勤怠詳細 | requireAuth |
| AT-5 | PUT | `/api/attendances/:id` | 勤怠編集（管理者） | admin |
| AT-6 | PUT | `/api/attendances/:id/confirm` | 勤怠確認（本人） | requireAuth |
| AT-7 | PUT | `/api/attendances/:id/approve` | 勤怠承認 | admin/manager |
| AT-8 | PUT | `/api/attendances/:id/allocations` | 勤怠配分編集（合計=実働） | requireAuth/manager/admin |
| **月末締め** |
| MC-1 | GET | `/api/monthly-closing` | 月末締め状況取得 | admin |
| MC-2 | POST | `/api/monthly-closing/aggregate` | 勤怠集計実行 | admin |
| MC-3 | POST | `/api/monthly-closing/slack-notify` | Slack確認依頼一括送信 | admin |
| MC-4 | POST | `/api/monthly-closing/slack-notify/:memberId` | 個別再通知 | admin |
| MC-5 | POST | `/api/monthly-closing/force-confirm` | 強制確定 | admin |
| MC-6 | POST | `/api/monthly-closing/generate-invoices` | 請求書一括生成 | admin |
| **請求書** |
| IV-1 | GET | `/api/invoices` | 請求書一覧 | requireAuth |
| IV-2 | GET | `/api/invoices/:id` | 請求書詳細 | requireAuth |
| IV-3 | GET | `/api/invoices/:id/download-url` | ダウンロードURL取得（署名付きURL）| requireAuth |
| IV-4 | POST | `/api/invoices/:id/regenerate` | 請求書再生成 | admin |
| IV-5 | POST | `/api/invoices/:id/slack-send` | Slack DM再送 | admin |
| **PL/CF・社内精算** |
| PL-1 | GET | `/api/pl/projects/:projectId` | PJ別PL取得 | admin/manager |
| PL-2 | PUT | `/api/pl/projects/:projectId` | PJ別PL更新 | admin/manager |
| PL-3 | GET | `/api/pl/summary` | 全社PLサマリー取得（会社別/会社ラベル別を切替、内部取引は相殺表示可能） | admin |
| IS-1 | GET | `/api/internal-settlement?month=` | Boost↔SALT2 社内精算サマリー | admin |
| CF-1 | GET | `/api/cashflow` | CF取得 | admin |
| CF-2 | PUT | `/api/cashflow` | CF更新 | admin |
| **契約書 (DocuSign)** |
| CT-1 | POST | `/api/contracts/send` | 契約書送信（テンプレ差し込み→DocuSign送信） | admin |
| CT-2 | POST | `/api/contracts/webhook` | DocuSign 完了Webhook受信 | public (検証必須) |
| CT-3 | GET | `/api/contracts/:id/download-url` | 署名済PDFの署名付きURL取得 | admin/本人 |

---

## 5. API詳細: 認証（C-01）/ マイページ（C-04）

### A-1: POST /api/auth/login

**認可:** public（認証不要）

**Request:**
```json
{
  "email": "yamada@example.com",
  "password": "P@ssw0rd123"
}
```

**Response 200:**
```json
{
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "memberId": "550e8400-e29b-41d4-a716-446655440001",
      "email": "yamada@example.com",
      "role": "intern",
      "name": "山田 さくら"
    },
    "expires": "2026-02-21T10:00:00Z"
  }
}
```

**Response 401:** 認証失敗
```json
{ "error": { "code": "INVALID_CREDENTIALS", "message": "メールアドレスまたはパスワードが正しくありません" } }
```

**Response 429:** レート制限超過
```json
{ "error": { "code": "TOO_MANY_ATTEMPTS", "message": "ログインを一時的にブロックしました。15分後に再試行してください" } }
```

---

### A-2: POST /api/auth/logout

**認可:** requireAuth

**Response 200:**
```json
{ "data": { "message": "ログアウトしました" } }
```

---

### A-3: GET /api/auth/session

セッション情報を返す。

**認可:** requireAuth

**Response 200:**
```json
{
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "memberId": "550e8400-e29b-41d4-a716-446655440001",
      "email": "yamada@example.com",
      "role": "intern",
      "name": "山田 さくら"
    },
    "expires": "2026-02-21T10:00:00Z"
  }
}
```

**Response 401:** セッションなし
```json
{ "error": { "code": "UNAUTHORIZED", "message": "ログインが必要です" } }
```

---

## 5-2. API詳細: マイページ（C-04）

### MY-1: PUT /api/me/email

**認可:** requireAuth（本人のみ）

**Request:**
```json
{
  "newEmail": "yamada-new@example.com",
  "currentPassword": "P@ssw0rd123"
}
```

**Response 200:**
```json
{ "data": { "message": "メールアドレスを変更しました。再ログインしてください。" } }
```

> レスポンス後、サーバー側でセッションを無効化する。クライアントはログイン画面にリダイレクト。

**Response 400:**
```json
{ "error": { "code": "EMAIL_ALREADY_USED", "message": "このメールアドレスはすでに使用されています" } }
```

**Response 401:**
```json
{ "error": { "code": "INVALID_PASSWORD", "message": "現在のパスワードが正しくありません" } }
```

---

### MY-2: PUT /api/me/password

**認可:** requireAuth（本人のみ）

**Request:**
```json
{
  "currentPassword": "P@ssw0rd123",
  "newPassword": "NewP@ss456",
  "newPasswordConfirm": "NewP@ss456"
}
```

**Response 200:**
```json
{ "data": { "message": "パスワードを変更しました" } }
```

**Response 400（バリデーションエラー）:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "入力内容を確認してください",
    "details": [
      { "field": "newPassword", "message": "8文字以上で入力してください" }
    ]
  }
}
```

**Response 401:**
```json
{ "error": { "code": "INVALID_PASSWORD", "message": "現在のパスワードが正しくありません" } }
```

---

### MY-3: PUT /api/admin/users/:id/password

**認可:** admin のみ

**Request:**
```json
{
  "newPassword": "TempP@ss789"
}
```

**Response 200:**
```json
{ "data": { "message": "パスワードをリセットしました" } }
```

---

## 6. API詳細: ダッシュボード（C-02）

### D-1: GET /api/dashboard

ロールに応じたウィジェットデータを返す。サーバー側でロールを確認し必要なデータのみ返す。

**Query:** なし（セッションからロールを取得）

**Response 200（admin）:**
```json
{
  "data": {
    "clockStatus": {
      "unclockedCount": 3
    },
    "monthlyClosing": {
      "pendingCount": 5,
      "targetMonth": "2026-02"
    },
    "companyPL": {
      "targetMonth": "2026-02",
      "grossProfit": 1300000,
      "grossProfitRate": 21.67
    },
    "alerts": [
      { "type": "unclocked", "message": "3名が未打刻です", "link": "/attendance" },
      { "type": "closing", "message": "月末締め確認待ち 5名", "link": "/monthly-closing" }
    ]
  }
}
```

**Response 200（manager）:**
```json
{
  "data": {
    "clockStatus": { "unclockedCount": 2 },
    "assignedProjects": [
      { "id": "uuid", "name": "〇〇社AI開発", "status": "active", "assignedCount": 3 }
    ]
  }
}
```

**Response 200（employee / intern）:**
```json
{
  "data": {
    "todayAttendance": {
      "clockedIn": true,
      "clockIn": "2026-02-20T10:00:00+09:00",
      "clockOut": null
    }
  }
}
```

---

## 7. API詳細: 設定（C-03）

### S-1: GET /api/settings

**認可:** admin のみ

**Response 200:**
```json
{
  "data": {
    "slackWebhookUrl": "https://hooks.slack.com/...****",
    "slackAttendanceChannel": "#attendance",
    "monthlyClosingNotifyDay": 25,
    "companyNameParent": "ブーストコンサルティング",
    "companyNameChild": "SALT2"
  }
}
```

> `slackWebhookUrl` は末尾 8 文字のみ表示、それ以外はマスク（`****`）

---

### S-2: PUT /api/settings

**認可:** admin のみ

**Request:**
```json
{
  "slackWebhookUrl": "https://hooks.slack.com/services/T.../B.../xxx",
  "slackAttendanceChannel": "#attendance",
  "monthlyClosingNotifyDay": 25,
  "companyNameParent": "ブーストコンサルティング",
  "companyNameChild": "SALT2"
}
```

**Response 200:**
```json
{ "data": { "message": "設定を保存しました" } }
```

---

### S-3: POST /api/settings/slack/test

**認可:** admin のみ

**Response 200:**
```json
{ "data": { "success": true, "message": "接続に成功しました" } }
```

**Response 200（失敗）:**
```json
{ "data": { "success": false, "message": "Slack への接続に失敗しました。URL を確認してください" } }
```

---

## 8. API詳細: メンバー（M1）

### M-1: GET /api/members

**認可:** requireAuth（ロールによりレスポンスをフィルタ）

**Query:**
```
?status=intern_training
&company=boost
&role=intern
&q=田中
&includeLeft=false    // 退社済み含む場合は true
```

**Response 200（admin）:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "山田 さくら",
      "profileImageUrl": "https://storage.example.com/...",
      "status": "intern_training",
      "company": "boost",
      "email": "yamada@example.com",
      "role": "intern",
      "joinedAt": "2026-04-01"
    }
  ],
  "meta": { "total": 20 }
}
```

**Response 200（employee）:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "山田 さくら",
      "profileImageUrl": "https://...",
      "status": "intern_training",
      "company": "boost"
      // email, role, joinedAt は含まれない
    }
  ]
}
```

---

### M-2: POST /api/members

**認可:** admin のみ

**Request:**
```json
{
  "name": "山田 さくら",
  "email": "yamada@example.com",
  "role": "intern",
  "phone": "090-1234-5678",
  "address": "東京都渋谷区...",
  "status": "intern_training",
  "company": "boost",
  "salaryType": "hourly",
  "salaryAmount": 1500,
  "bankName": "三菱UFJ銀行",
  "bankBranch": "渋谷支店",
  "bankAccountNumber": "1234567",
  "bankAccountHolder": "ヤマダ サクラ",
  "joinedAt": "2026-04-01",
  "leftAt": null,
  "profileImageUrl": null
}
```

**Response 201:**
```json
{
  "data": {
    "id": "uuid",
    "name": "山田 さくら",
    "email": "yamada@example.com"
  }
}
```

**Response 409（メール重複）:**
```json
{
  "error": {
    "code": "CONFLICT",
    "message": "このメールアドレスはすでに登録されています",
    "details": [{ "field": "email", "message": "このメールアドレスはすでに登録されています" }]
  }
}
```

---

### M-3: GET /api/members/:id

**認可:** requireAuth（全ロールがアクセス可能。返却フィールドはロールで制御）

**フィールド公開制御:**
| フィールド群 | 公開対象 |
|------------|---------|
| `weeklySchedule`, 基本プロフィール, `skills`, `assignments` | 全ロール |
| `salaryType`, `salaryAmount`, `email`, `role` | admin のみ |
| `bankName`, `bankBranch`, `bankAccountNumber`, `bankAccountHolder` | admin + 本人のみ |
| `tools`, `contracts` | admin + 本人のみ |

**Response 200（admin、当週スケジュール含む全項目）:**
```json
{
  "data": {
    "weeklySchedule": [
      { "date": "2026-02-16", "startTime": "09:00", "endTime": "18:00", "isOff": false },
      { "date": "2026-02-17", "startTime": null, "endTime": null, "isOff": true },
      { "date": "2026-02-18", "startTime": "10:00", "endTime": "19:00", "isOff": false },
      { "date": "2026-02-19", "startTime": "10:00", "endTime": "19:00", "isOff": false },
      { "date": "2026-02-20", "startTime": "10:00", "endTime": "19:00", "isOff": false },
      { "date": "2026-02-21", "startTime": null, "endTime": null, "isOff": true },
      { "date": "2026-02-22", "startTime": null, "endTime": null, "isOff": true }
    ],
    "id": "uuid",
    "name": "山田 さくら",
    "profileImageUrl": "https://...",
    "phone": "090-1234-5678",
    "address": "東京都渋谷区...",
    "status": "intern_training",
    "company": "boost",
    "email": "yamada@example.com",
    "role": "intern",
    "salaryType": "hourly",
    "salaryAmount": 1500,
    "bankName": "三菱UFJ銀行",
    "bankBranch": "渋谷支店",
    "bankAccountNumber": "1234567",
    "bankAccountHolder": "ヤマダ サクラ",
    "joinedAt": "2026-04-01",
    "leftAt": null,
    "skills": [
      { "skillId": "uuid", "skillName": "フロントエンド", "categoryName": "エンジニアリング", "level": 3, "evaluatedAt": "2026-02-18" }
    ],
    "assignments": [
      { "projectId": "uuid", "projectName": "〇〇社AI開発", "positionName": "フロントエンドエンジニア", "workloadHours": 80, "startDate": "2026-03-01", "endDate": null }
    ],
    "tools": [
      { "id": "uuid", "toolName": "Claude", "plan": "Pro", "monthlyCost": 6800, "companyLabel": "boost" }
    ],
    "contracts": [
      { "id": "uuid", "status": "completed", "templateName": "雇用契約書_v1", "startDate": "2026-04-01", "completedAt": "2026-03-15T10:00:00Z" }
    ]
  }
}
```

**Response 200（社員/インターンが他メンバー閲覧時 — 機密フィールド省略）:**
```json
{
  "data": {
    "weeklySchedule": [ ... ],
    "id": "uuid",
    "name": "山田 さくら",
    "profileImageUrl": "https://...",
    "status": "intern_training",
    "company": "boost",
    "joinedAt": "2026-04-01",
    "leftAt": null,
    "skills": [ ... ],
    "assignments": [ ... ]
    // phone, address, email, role, salary*, bank*, tools, contracts は含まない
  }
}
```

---

### M-4: PUT /api/members/:id

**認可:** admin（全項目）/ 本人（name, phone, address, bank情報のみ）

**Request（admin）:** M-2 と同構造（全項目）

**Request（本人）:**
```json
{
  "name": "山田 さくら",
  "phone": "090-9999-8888",
  "address": "東京都新宿区...",
  "bankName": "みずほ銀行",
  "bankBranch": "新宿支店",
  "bankAccountNumber": "7654321",
  "bankAccountHolder": "ヤマダ サクラ"
}
```

**Response 200:**
```json
{ "data": { "id": "uuid", "name": "山田 さくら" } }
```

---

### M-5: DELETE /api/members/:id

**認可:** admin のみ（論理削除: `deleted_at` を設定）

**Response 204:** No Content

---

## 8-2. API詳細: メンバーツール（M1-04）

### MT-1: GET /api/members/:id/tools

**認可:** admin または本人のみ（それ以外は 403）

**Response 200:**
```json
{
  "data": {
    "tools": [
      {
        "id": "uuid",
        "toolName": "Claude",
        "plan": "Pro",
        "monthlyCost": 6800,
        "companyLabel": "boost",
        "note": ""
      },
      {
        "id": "uuid2",
        "toolName": "Figma",
        "plan": "Professional",
        "monthlyCost": 1800,
        "companyLabel": "salt2",
        "note": "デザイン用"
      }
    ],
    "totalMonthlyCost": 8600
  }
}
```

---

### MT-2: POST /api/members/:id/tools

**認可:** admin のみ

**Request:**
```json
{
  "toolName": "Claude",
  "plan": "Pro",
  "monthlyCost": 6800,
  "companyLabel": "boost",
  "note": ""
}
```

**Response 201:**
```json
{
  "data": {
    "id": "uuid",
    "toolName": "Claude",
    "plan": "Pro",
    "monthlyCost": 6800,
    "companyLabel": "boost"
  }
}
```

---

### MT-3: PUT /api/members/:id/tools/:toolId

**認可:** admin のみ

**Request:** MT-2 と同構造

**Response 200:**
```json
{ "data": { "id": "uuid", "toolName": "Claude", "monthlyCost": 6800 } }
```

---

### MT-4: DELETE /api/members/:id/tools/:toolId

**認可:** admin のみ

**Response 204:** No Content

---

## 8-3. API詳細: メンバー契約書（M1-05）

### MC-1: GET /api/members/:id/contracts

**認可:** admin または本人のみ（それ以外は 403）

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "status": "completed",
      "templateName": "雇用契約書_v1",
      "startDate": "2026-04-01",
      "endDate": null,
      "sentAt": "2026-03-10T10:00:00Z",
      "completedAt": "2026-03-15T10:00:00Z",
      "hasFile": true
    }
  ]
}
```

> `signer_email` はレスポンスに含めない（管理者も原則不要）

---

### MC-2: POST /api/members/:id/contracts

**認可:** admin のみ（下書き作成）

**Request:**
```json
{
  "templateName": "雇用契約書_v1",
  "signerEmail": "yamada@example.com",
  "startDate": "2026-04-01",
  "endDate": null
}
```

**Response 201:**
```json
{
  "data": {
    "id": "uuid",
    "status": "draft",
    "templateName": "雇用契約書_v1",
    "startDate": "2026-04-01"
  }
}
```

---

### MC-3: POST /api/members/:id/contracts/:cId/send

**認可:** admin のみ（DocuSign 署名依頼送信）

**Request:** なし（Body 不要）

**Response 200:**
```json
{
  "data": {
    "id": "uuid",
    "status": "sent",
    "sentAt": "2026-03-10T10:00:00Z",
    "message": "署名依頼メールを送信しました"
  }
}
```

**Response 502（DocuSign API エラー）:**
```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "署名依頼の送信に失敗しました。しばらく経ってから再試行してください"
  }
}
```

---

### MC-4: PUT /api/members/:id/contracts/:cId/void

**認可:** admin のみ

**Request:** なし（Body 不要）

**Response 200:**
```json
{
  "data": {
    "id": "uuid",
    "status": "voided"
  }
}
```

---

### MC-5: GET /api/members/:id/contracts/:cId/download-url

**認可:** admin または本人のみ（`status = 'completed'` のみ有効）

**Response 200:**
```json
{
  "data": {
    "url": "https://storage.example.com/contracts/member-uuid/contract-uuid.pdf?X-Amz-Signature=...",
    "expiresAt": "2026-02-20T10:05:00Z"
  }
}
```

**Response 404（ファイル未生成 or 未完了）:**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "署名済みファイルが見つかりません"
  }
}
```

---

### MC-6: POST /api/webhooks/docusign

**認可:** `X-DocuSign-Signature-1` ヘッダーの HMAC 署名を検証（`DOCUSIGN_HMAC_KEY` 使用）

**Request（DocuSign から送信される）:**
```json
{
  "event": "envelope-completed",
  "data": {
    "envelopeId": "docusign-envelope-id",
    "status": "completed",
    "completedDateTime": "2026-03-15T10:00:00Z"
  }
}
```

**処理フロー:**
1. HMAC 署名を検証（失敗時は 401 を返す）
2. `envelopeId` から `member_contracts` レコードを特定
3. DocuSign API から署名済み PDF を取得してストレージに保存
4. `file_url` / `file_hash` / `completed_at` / `status` を `'completed'` に更新

**Response 200:**
```json
{ "data": { "message": "ok" } }
```

**Response 401（署名検証失敗）:**
```json
{ "error": { "code": "UNAUTHORIZED", "message": "Invalid webhook signature" } }
```

---

## 9. API詳細: スキル（M2）

### SK-1: GET /api/skill-categories

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "エンジニアリング",
      "description": "技術スキル",
      "displayOrder": 1,
      "skills": [
        { "id": "uuid", "name": "フロントエンド", "displayOrder": 1 }
      ]
    }
  ]
}
```

---

### SK-2: POST /api/skill-categories

**Request:**
```json
{ "name": "デザイン", "description": "UIデザイン等", "displayOrder": 3 }
```

**Response 201:**
```json
{ "data": { "id": "uuid", "name": "デザイン", "displayOrder": 3 } }
```

---

### SK-5: PUT /api/skill-categories/reorder

**Request:**
```json
{ "orders": [{ "id": "uuid-1", "displayOrder": 1 }, { "id": "uuid-2", "displayOrder": 2 }] }
```

**Response 200:**
```json
{ "data": { "message": "並び順を更新しました" } }
```

---

### SE-1: GET /api/skill-matrix

**認可:** requireAuth（intern は自分のみ）

**Query:**
```
?categoryId=uuid
&minLevel=3
&company=boost
```

**Response 200:**
```json
{
  "data": {
    "categories": [
      { "id": "uuid", "name": "エンジニアリング", "skills": [{ "id": "uuid", "name": "フロントエンド" }] }
    ],
    "members": [
      {
        "id": "uuid",
        "name": "山田 さくら",
        "lastUpdatedAt": "2026-02-18",
        "isStale": false,
        "skills": {
          "skill-uuid-1": { "level": 3, "evaluatedAt": "2026-02-18" },
          "skill-uuid-2": null
        }
      }
    ]
  }
}
```

---

### SE-3: POST /api/members/:id/skills

**認可:** admin または担当 manager

**Request:**
```json
{
  "skillId": "uuid",
  "level": 3,
  "evaluatedAt": "2026-02-20",
  "memo": "React 実務 1 年"
}
```

**Response 201:**
```json
{
  "data": {
    "id": "uuid",
    "memberId": "uuid",
    "skillId": "uuid",
    "level": 3,
    "evaluatedAt": "2026-02-20",
    "memo": "React 実務 1 年",
    "evaluatedBy": "uuid"
  }
}
```

---

## 10. API詳細: プロジェクト（M3）

### P-1: GET /api/projects

**認可:** requireAuth（employee/intern は自分のアサインのみ）

**Query:**
```
?status=active
&company=boost
&q=AI開発
```

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "〇〇社AI開発",
      "status": "active",
      "company": "boost",
      "projectType": "boost_dispatch",
      "clientName": "株式会社〇〇",
      "startDate": "2026-03-01",
      "endDate": "2026-09-30",
      "assignedCount": 3
    }
  ],
  "meta": { "total": 10 }
}
```

---

### P-2: POST /api/projects

**認可:** admin / manager

**Request:**
```json
{
  "name": "〇〇社AI開発",
  "description": "AI機能の開発",
  "status": "planning",
  "company": "boost",
  "projectType": "boost_dispatch",
  "startDate": "2026-03-01",
  "endDate": "2026-09-30",
  "clientName": "株式会社〇〇",
  "contractType": "quasi_mandate",
  "monthlyContractAmount": 500000,
  "positions": [
    {
      "positionName": "PM",
      "requiredCount": 1,
      "requiredSkills": [
        { "skillId": "uuid", "minLevel": 4 }
      ]
    },
    {
      "positionName": "フロントエンドエンジニア",
      "requiredCount": 2,
      "requiredSkills": [
        { "skillId": "uuid", "minLevel": 3 }
      ]
    }
  ]
}
```

**Response 201:**
```json
{ "data": { "id": "uuid", "name": "〇〇社AI開発" } }
```

---

### P-7: POST /api/projects/:id/assignments

**認可:** admin / 担当 manager

**Request:**
```json
{
  "memberId": "uuid",
  "positionId": "uuid",
  "workloadHours": 80,
  "startDate": "2026-03-01",
  "endDate": null
}
```

**Response 201:**
```json
{
  "data": {
    "id": "uuid",
    "memberId": "uuid",
    "positionId": "uuid",
    "workloadHours": 80,
    "startDate": "2026-03-01",
    "endDate": null
  }
}
```

**Response 409（重複）:**
```json
{
  "error": {
    "code": "CONFLICT",
    "message": "このメンバーはすでにこのポジションにアサイン済みです"
  }
}
```

---

### P-9: GET /api/workload

**認可:** admin / manager

**Query:**
```
?month=2026-02
```

**Response 200:**
```json
{
  "data": {
    "month": "2026-02",
    "projects": [
      { "id": "uuid", "name": "〇〇社AI開発" }
    ],
    "members": [
      { "id": "uuid", "name": "山田 さくら" }
    ],
    "matrix": {
      "member-uuid-1": {
        "project-uuid-1": 80,
        "project-uuid-2": 40,
        "total": 120
      }
    },
    "projectTotals": {
      "project-uuid-1": 240,
      "project-uuid-2": 80
    }
  }
}
```

---

### P-10: PUT /api/workload

**認可:** admin / manager

**Request:**
```json
{
  "month": "2026-02",
  "updates": [
    { "assignmentId": "uuid", "workloadHours": 100 },
    { "assignmentId": "uuid2", "workloadHours": 60 }
  ]
}
```

**Response 200:**
```json
{ "data": { "updatedCount": 2 } }
```

---

## 11. API詳細: 勤怠（M4）

### WS-2: PUT /api/members/:id/work-schedules

**認可:** admin（全員）/ 本人（前日以前のみ）

**Request:**
```json
{
  "weekStart": "2026-02-23",
  "schedules": [
    { "date": "2026-02-23", "startTime": "10:00", "endTime": "19:00", "isOff": false },
    { "date": "2026-02-24", "startTime": "10:00", "endTime": "19:00", "isOff": false },
    { "date": "2026-02-25", "startTime": null, "endTime": null, "isOff": true },
    { "date": "2026-02-26", "startTime": "10:00", "endTime": "19:00", "isOff": false },
    { "date": "2026-02-27", "startTime": "10:00", "endTime": "19:00", "isOff": false },
    { "date": "2026-02-28", "startTime": null, "endTime": null, "isOff": true },
    { "date": "2026-03-01", "startTime": null, "endTime": null, "isOff": true }
  ]
}
```

**Response 200:**
```json
{ "data": { "message": "勤務予定を登録しました", "upsertedCount": 7 } }
```

---

### AT-2: POST /api/attendances/clock-in

**認可:** requireAuth（自分のみ）

**Request:**
```json
{ "todoToday": "〇〇機能の実装" }
```

**Response 201:**
```json
{
  "data": {
    "id": "uuid",
    "memberId": "uuid",
    "date": "2026-02-20",
    "clockIn": "2026-02-20T10:00:00+09:00",
    "todoToday": "〇〇機能の実装",
    "slackNotified": false
  }
}
```

**Response 409（二重打刻）:**
```json
{
  "error": {
    "code": "CONFLICT",
    "message": "本日はすでに出勤済みです"
  }
}
```

---

### AT-3: POST /api/attendances/clock-out

**認可:** requireAuth（自分のみ、当日出勤済みであること）

**Request（例）:**
```json
{
  "breakMinutes": 60,
  "doneToday": "APIの単体テスト",
  "todoTomorrow": "E2Eテスト",
  "projectAllocations": [
    { "projectId": "uuid-pj-1", "minutes": 180 },
    { "projectId": "uuid-pj-2", "minutes": 120 }
  ]
}
```
- `projectAllocations` は minutes でも percent でも送信可。サーバ側で分に換算し、合計=実働を検証。自動初期値なし。

**Response 201（例）:**
```json
{
  "data": {
    "id": "uuid-att-123",
    "memberId": "uuid-mem-1",
    "date": "2026-02-20",
    "clockIn": "2026-02-20T10:00:00+09:00",
    "clockOut": "2026-02-20T19:00:00+09:00",
    "breakMinutes": 60,
    "workMinutes": 480,
    "doneToday": "APIの単体テスト",
    "todoTomorrow": "E2Eテスト",
    "projectAllocations": [
      { "projectId": "uuid-pj-1", "minutes": 180 },
      { "projectId": "uuid-pj-2", "minutes": 120 }
    ],
    "slackNotified": true
  }
}
```

**Response 400（合計不一致）:**
```json
{
  "error": {
    "code": "ALLOC_TOTAL_MISMATCH",
    "message": "Project allocation total must equal work minutes (480)"
  }
}
```

---

### AT-8: PUT /api/attendances/:id/allocations

**認可:** requireAuth（本人） / manager / admin

**概要:** 退勤後のプロジェクト配分を修正する（合計=実働をサーバで再検証）

**Request（例）:**
```json
{
  "projectAllocations": [
    { "projectId": "uuid-pj-1", "minutes": 200 },
    { "projectId": "uuid-pj-2", "minutes": 160 }
  ]
}
```

**Response 200（例）:**
```json
{ "data": { "updated": true, "totalMinutes": 360 } }
```

**Response 400（合計不一致）:**
```json
{
  "error": {
    "code": "ALLOC_TOTAL_MISMATCH",
    "message": "Project allocation total must equal work minutes"
  }
}
```

---

### AT-1: GET /api/attendances

**認可:** requireAuth（ロールにより範囲制限）

**Query:**
```
?memberId=uuid
&month=2026-02
```

**Response 200:**
```json
{
  "data": {
    "attendances": [
      {
        "id": "uuid",
        "date": "2026-02-20",
        "clockIn": "2026-02-20T10:00:00+09:00",
        "clockOut": "2026-02-20T19:00:00+09:00",
        "breakMinutes": 60,
        "workMinutes": 480,
        "doneToday": "〇〇機能完成",
        "status": "normal",
        "confirmStatus": "unconfirmed"
      }
    ],
    "summary": {
      "workDays": 15,
      "totalWorkMinutes": 7200,
      "salaryType": "hourly",
      "salaryAmount": 1500,
      "estimatedPay": 180000
    }
  }
}
```

> `summary.salaryAmount` / `estimatedPay` は admin または本人のみ返す

---

### AT-7: PUT /api/attendances/:id/approve

**認可:** admin / 担当 manager

**Request:**
```json
{ "approved": true }
```

**Response 200:**
```json
{
  "data": {
    "id": "uuid",
    "confirmStatus": "approved"
  }
}
```

---

### CA-1: GET /api/calendar

**認可:** requireAuth（ロールにより返すメンバー範囲を制限）

**Query:**
```
?from=2026-02-17
&to=2026-02-23
&projectId=uuid     // PJフィルター（任意）
&company=boost      // 会社フィルター（任意）
```

**Response 200:**
```json
{
  "data": [
    {
      "memberId": "uuid",
      "memberName": "山田 さくら",
      "days": [
        {
          "date": "2026-02-17",
          "schedule": { "startTime": "10:00", "endTime": "19:00", "isOff": false },
          "attendance": { "clockIn": "2026-02-17T10:05:00+09:00", "clockOut": "2026-02-17T19:10:00+09:00" },
          "isMissing": false
        },
        {
          "date": "2026-02-18",
          "schedule": { "startTime": "10:00", "endTime": "19:00", "isOff": false },
          "attendance": null,
          "isMissing": true
        }
      ]
    }
  ]
}
```

---

## 12. API詳細: 請求（M5）

### MC-1: GET /api/monthly-closing

**認可:** admin のみ

**Query:**
```
?month=2026-02
```

**Response 200:**
```json
{
  "data": {
    "targetMonth": "2026-02",
    "members": [
      {
        "memberId": "uuid",
        "name": "山田 さくら",
        "workDays": 15,
        "totalWorkMinutes": 7200,
        "missingDays": 1,
        "confirmStatus": "unconfirmed",
        "invoiceStatus": "not_generated",
        "salaryAmount": 1500,
        "estimatedPay": 180000
      }
    ]
  }
}
```

---

### MC-2: POST /api/monthly-closing/aggregate

**認可:** admin のみ

**Request:**
```json
{ "targetMonth": "2026-02", "forceWithMissing": false }
```

**Response 202（バックグラウンド処理）:**
```json
{
  "data": {
    "jobId": "job-uuid",
    "status": "processing",
    "message": "集計を開始しました。完了まで最大30秒かかります"
  }
}
```

**Response 400（未打刻ありで `forceWithMissing=false`）:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "3名に未打刻日があります",
    "details": [
      { "field": "missingMembers", "message": "山田 さくら (2日), 田中 一郎 (1日)" }
    ]
  }
}
```

---

### IV-1: GET /api/invoices

**認可:** requireAuth（admin は全員、それ以外は自分のみ）

**Query:**
```
?month=2026-02
&memberId=uuid      // admin のみ有効
```

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "invoiceNumber": "2026-02-001",
      "memberId": "uuid",
      "memberName": "山田 さくら",
      "targetMonth": "2026-02",
      "workHoursTotal": 120.5,
      "unitPrice": 1500,
      "amountExclTax": 180750,
      "amountInclTax": 198825,
      "amountBoost": 108450,
      "amountSalt2": 72300,
      "issuedAt": "2026-03-01",
      "slackSentStatus": "unsent",
      "hasFile": true
    }
  ],
  "meta": { "total": 5 }
}
```

> `unitPrice`, `amountBoost`, `amountSalt2` は admin のみレスポンスに含める

---

### IV-3: GET /api/invoices/:id/download-url

**認可:** requireAuth（admin または本人）

**Response 200:**
```json
{
  "data": {
    "url": "https://storage.example.com/invoices/2026-02/001.xlsx?X-Amz-Signature=...",
    "expiresAt": "2026-02-20T10:05:00Z"
  }
}
```

---

## 13. API詳細: PL・CF（M6）

### PL-1: GET /api/pl/projects/:projectId

**認可:** admin / 担当 manager

**Query:**
```
?month=2026-02
```

**Response 200:**
```json
{
  "data": {
    "projectId": "uuid",
    "projectName": "〇〇社AI開発",
    "targetMonth": "2026-02",
    "revenueContract": 500000,
    "revenueExtra": 100000,
    "costLaborMonthly": 300000,
    "costLaborHourly": 80000,
    "costOutsourcing": 80000,
    "costTools": 15000,
    "costOther": 10000,
    "grossProfit": 115000,
    "grossProfitRate": 19.17,
    "markupRate": null,
    "isAttendanceAggregated": true,
    "laborBreakdown": [
      {
        "memberId": "uuid",
        "name": "田中 一郎",
        "salaryType": "monthly",
        "salaryAmount": 300000,
        "workloadHours": 80,
        "totalHours": 160,
        "allocatedCost": 150000
      }
    ]
  }
}
```

---

### PL-2: PUT /api/pl/projects/:projectId

**認可:** admin / 担当 manager

**Request:**
```json
{
  "targetMonth": "2026-02",
  "revenueContract": 500000,
  "revenueExtra": 100000,
  "costOutsourcing": 80000,
  "costTools": 15000,
  "costOther": 10000
}
```

> `costTools` は自動計算値。リクエストで指定した場合は手動上書きとして扱う（省略時は自動計算）。

**Response 200:**
```json
{
  "data": {
    "grossProfit": 115000,
    "grossProfitRate": 19.17
  }
}
```

---

### PL-3: GET /api/pl/summary

**認可:** admin のみ

**Query:**
```
?month=2026-02
&company=all              // all | boost | salt2
&consolidation=on         // on=内部取引相殺, off=表示
&view=company             // company | company_label
```

**Response 200（例）:**
```json
{
  "data": {
    "targetMonth": "2026-02",
    "view": "company",
    "consolidation": "on",
    "companies": [
      {
        "company": "boost",
        "revenue": 1200000,
        "cost": {
          "laborMonthly": 400000,
          "laborHourly": 120000,
          "outsourcing": 80000,
          "tools": 15000,
          "other": 50000,
          "internalSettlement": -150000
        },
        "grossProfit": 400000,
        "grossProfitRate": 33.3
      },
      {
        "company": "salt2",
        "revenue": 800000,
        "cost": {
          "laborMonthly": 300000,
          "laborHourly": 100000,
          "outsourcing": 40000,
          "tools": 12000,
          "other": 30000,
          "internalSettlement": 150000
        },
        "grossProfit": 168000,
        "grossProfitRate": 21.0
      }
    ]
  }
}
```

---

### IS-1: GET /api/internal-settlement

**認可:** admin

**Query:**
```
?month=2026-02
```

**Response 200（例）:**
```json
{
  "data": {
    "targetMonth": "2026-02",
    "settlements": [
      { "from": "salt2", "to": "boost", "amount": 150000 },
      { "from": "boost", "to": "salt2", "amount": 0 }
    ],
    "netting": {
      "boost": 150000,
      "salt2": -150000
    }
  }
}
```

---

### CF-1: GET /api/cashflow

**認可:** admin のみ

**Query:**
```
?month=2026-02
```

**Response 200:**
```json
{
  "data": {
    "targetMonth": "2026-02",
    "cfCashInClient": 500000,
    "cfCashInOther": 0,
    "cfCashOutSalary": 285000,
    "cfCashOutOutsourcing": 80000,
    "cfCashOutFixed": 200000,
    "cfCashOutOther": 10000,
    "cfBalancePrev": 3000000,
    "cfBalanceCurrent": 2925000,
    "monthlyBalance": -75000,
    "memo": "〇〇社3月分入金",
    "isPrevBalanceSet": true
  }
}
```

---

### CF-2: PUT /api/cashflow

**認可:** admin のみ

**Request:**
```json
{
  "targetMonth": "2026-02",
  "cfCashInClient": 500000,
  "cfCashInOther": 0,
  "cfCashOutOutsourcing": 80000,
  "cfCashOutFixed": 200000,
  "cfCashOutOther": 10000,
  "cfBalancePrev": 3000000,
  "memo": "〇〇社3月分入金"
}
```

> `cfCashOutSalary` は `invoices` から自動計算するためリクエストに含めない

**Response 200:**
```json
{
  "data": {
    "cfBalanceCurrent": 2925000,
    "monthlyBalance": -75000
  }
}
```

---

## 13-2. API詳細: 月次自己申告（C-04）

### SR-1: GET /api/me/self-reports

**認可:** requireAuth（自分のみ）

**Query:**
```
?month=2026-02
```

**Response 200:**
```json
{
  "data": {
    "targetMonth": "2026-02",
    "submittedAt": null,
    "allocations": [
      {
        "projectId": "uuid-pj-1",
        "projectName": "〇〇社AI開発",
        "reportedHours": 80.0,
        "note": ""
      },
      {
        "projectId": "uuid-pj-2",
        "projectName": "△△社保守",
        "reportedHours": 40.0,
        "note": "仕様変更対応含む"
      }
    ],
    "totalReportedHours": 120.0,
    "actualWorkMinutes": 7200,
    "actualWorkHours": 120.0
  }
}
```

> `actualWorkHours` は当月の勤怠実績合計（`attendances.work_minutes / 60`）。差分が 8h 超の場合は警告表示の基準とする。

---

### SR-2: PUT /api/me/self-reports

**認可:** requireAuth（自分のみ）

**Request:**
```json
{
  "targetMonth": "2026-02",
  "allocations": [
    { "projectId": "uuid-pj-1", "reportedHours": 80.0, "note": "" },
    { "projectId": "uuid-pj-2", "reportedHours": 40.0, "note": "仕様変更対応含む" }
  ]
}
```

**処理:** `monthly_self_reports` テーブルに `(member_id, target_month, project_id)` 単位で UPSERT。`submitted_at` は最終更新日時で自動設定。

**Response 200:**
```json
{
  "data": {
    "message": "自己申告を保存しました",
    "totalReportedHours": 120.0,
    "upsertedCount": 2
  }
}
```

**Response 400（アサインなしPJを指定）:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "入力内容に誤りがあります",
    "details": [
      { "field": "allocations[1].projectId", "message": "このプロジェクトへのアサインがありません" }
    ]
  }
}
```

---

## 14. ページ↔API対応表

| ページ | 使用するAPI |
|--------|-----------|
| C-01 ログイン | A-1（POST login）, A-3（セッション確認） |
| C-02 ダッシュボード | D-1 |
| C-03 設定 | S-1, S-2, S-3 |
| C-04 マイページ | A-2（logout）, MY-1, MY-2, MY-3（admin）, SR-1, SR-2（月次自己申告） |
| M1-01 メンバー一覧 | M-1 |
| M1-02 メンバー詳細 | M-3（週間スケジュール含む全項目）, MT-1, MC-1 |
| M1-03 メンバー登録/編集 | M-2 (POST), M-4 (PUT) |
| M1-04 ツール管理（詳細内モーダル） | MT-1, MT-2, MT-3, MT-4 |
| M1-05 契約書管理（詳細内モーダル） | MC-1, MC-2, MC-3, MC-4, MC-5, MC-6（Webhook） |
| M2-01 スキルマトリクス | SE-1, SK-1 |
| M2-02 スキル設定 | SK-1〜SK-10 |
| M2-03 スキル評価入力 | SE-2, SE-3, SK-1 |
| M3-01 プロジェクト一覧 | P-1 |
| M3-02 プロジェクト詳細 | P-3 |
| M3-03 プロジェクト登録/編集 | P-2 (POST), P-4 (PUT), SK-6（スキル選択） |
| M3-04 アサイン管理 | P-6, P-7, P-8, M-1, SE-1 |
| M3-05 工数管理 | P-9, P-10 |
| M4-01 全体カレンダー | CA-1 |
| M4-02 勤務予定登録 | WS-1, WS-2 |
| M4-03 打刻画面 | AT-1（当日確認）, AT-2, AT-3 |
| M4-04 勤怠一覧 | AT-1, AT-4, AT-5, AT-6, AT-7 |
| M5-01 月末締め管理 | MC-1, MC-2, MC-3, MC-4, MC-5, MC-6 |
| M5-02 請求書一覧 | IV-1, IV-2, IV-3, IV-4, IV-5 |
| M6-01 PJ別PL | PL-1, PL-2 |
| M6-02 全社PLサマリー | PL-3 |
| M6-03 キャッシュフロー管理 | CF-1, CF-2, IV-1（給与支払い自動取得） |
| 契約書（メンバー詳細内） | CT-1, CT-3 |

---

## 14.1 API詳細: 契約書（DocuSign連携）

### CT-1: POST /api/contracts/send
**認可:** admin（または採用連携サービスアカウント）

**概要:** 契約テンプレートに氏名・住所・契約日・報酬条件を差し込み、DocuSignへ送信。

**Request（例）**
```json
{
  "memberId": "uuid-mem-1",
  "templateId": "docusign-template-123",
  "contractDate": "2026-04-01",
  "salaryType": "monthly",
  "salaryAmount": 500000
}
```

**Response 200（例）**
```json
{
  "data": {
    "contractId": "uuid-contract-1",
    "docusignEnvelopeId": "env-123",
    "status": "sent"
  }
}
```

### CT-2: POST /api/contracts/webhook
**認可:** public（DocuSignのみ許可。署名・HMACで検証必須）

**概要:** DocuSign のイベント（署名完了/失効）を受信し、`member_contracts.status` と `file_url` を更新。

**Payload（DocuSign標準）**: envelopeId, status, completedAt, documentId など。

**Response 200:** `{ "ok": true }`

### CT-3: GET /api/contracts/:id/download-url
**認可:** admin / 契約対象の本人

**概要:** 署名済みPDFの一時的な署名付きURLを返す。

**Response 200（例）**
```json
{
  "data": {
    "downloadUrl": "https://s3...signedUrl",
    "expiresIn": 3600
  }
}
```

---

## 15. 監査ログ・トレーシング方針

### 監査ログ記録対象

書き込み操作（CREATE / UPDATE / DELETE）は `audit_logs` テーブルへ記録する。

**自動記録するエンドポイント:**

| API | action | target_table |
|-----|--------|--------------|
| MY-1 PUT /me/email | UPDATE | user_accounts |
| MY-2 PUT /me/password | UPDATE | user_accounts |
| MY-3 PUT /admin/users/:id/password | UPDATE | user_accounts |
| M-2 POST /members | CREATE | members |
| MT-2 POST .../tools | CREATE | member_tools |
| MT-3 PUT .../tools/:id | UPDATE | member_tools |
| MT-4 DELETE .../tools/:id | DELETE | member_tools |
| MC-2 POST .../contracts | CREATE | member_contracts |
| MC-3 POST .../contracts/:id/send | UPDATE | member_contracts |
| MC-4 PUT .../contracts/:id/void | UPDATE | member_contracts |
| MC-6 POST /webhooks/docusign | UPDATE | member_contracts |
| M-4 PUT /members/:id | UPDATE | members |
| M-5 DELETE /members/:id | UPDATE (deleted_at) | members |
| SE-3 POST .../skills | CREATE | member_skills |
| SK-2,7 POST categories/skills | CREATE | skill_categories / skills |
| SK-3,4,8,9 PUT/DELETE | UPDATE/DELETE | skill_categories / skills |
| P-2 POST /projects | CREATE | projects |
| P-4 PUT /projects/:id | UPDATE | projects |
| P-7 POST .../assignments | CREATE | project_assignments |
| P-8 PUT .../assignments/:id | UPDATE | project_assignments |
| WS-2 PUT .../work-schedules | UPDATE | work_schedules |
| AT-2 POST clock-in | CREATE | attendances |
| AT-3 POST clock-out | UPDATE | attendances |
| AT-5 PUT attendances/:id | UPDATE | attendances |
| AT-7 PUT .../approve | UPDATE | attendances |
| MC-5 POST force-confirm | UPDATE | attendances |
| MC-6 POST generate-invoices | CREATE | invoices |
| PL-2 PUT pl/projects/:id | CREATE/UPDATE | pl_records |
| CF-2 PUT cashflow | CREATE/UPDATE | pl_records |
| S-2 PUT settings | UPDATE | system_configs |
| AT-8 PUT .../allocations | UPDATE | attendance_allocations |
| SR-2 PUT /me/self-reports | CREATE/UPDATE | monthly_self_reports |
| CT-1 POST /api/contracts/send | CREATE | member_contracts |
| CT-2 POST /api/contracts/webhook | UPDATE | member_contracts |
| CT-3 GET /api/contracts/:id/download-url | READ | member_contracts (機微情報閲覧) |
| BANK-GET （口座閲覧API想定） | READ | members (bank_*) |
| TOOL-GET （ツール費明細閲覧） | READ | member_tools |

### Prisma Middleware による監査ログ実装方針

```typescript
// src/lib/prisma-audit.ts
prisma.$use(async (params, next) => {
  const result = await next(params);

  if (['create', 'update', 'delete'].includes(params.action)) {
    await prisma.auditLog.create({
      data: {
        operatorId: getCurrentUserId(),
        targetTable: params.model,
        targetId: result.id,
        action: params.action.toUpperCase(),
        beforeData: params.action !== 'create' ? getPreviousData() : null,
        afterData: params.action !== 'delete' ? result : null,
        ipAddress: getRequestIp(),
      }
    });
  }

  return result;
});
```

### リクエストトレーシング

- 全 API リクエストに `X-Request-Id`（UUID）を付与
- サーバーログに `requestId`, `userId`, `method`, `path`, `statusCode`, `durationMs` を構造化ログで出力
- エラーログには `requestId` を含め、追跡可能にする

```typescript
// ログフォーマット例
{
  "timestamp": "2026-02-20T10:00:00Z",
  "level": "INFO",
  "requestId": "req-uuid",
  "userId": "user-uuid",
  "method": "POST",
  "path": "/api/attendances/clock-in",
  "statusCode": 201,
  "durationMs": 123
}
```

### センシティブデータのマスク

以下のフィールドはログ出力・監査ログの `before_data` / `after_data` においてマスクする:

- `bank_name`, `bank_branch`, `bank_account_number`, `bank_account_holder`
- `system_configs.value`（`is_secret = true` のもの）
- `member_contracts.signer_email`

---

> **Design完了**
>
> 設計フェーズ（`/flow-design` → `/design-db` → `/design-requirements-v2` → `/design-api`）がすべて完了しました。
>
> **成果物一覧:**
> - `docs/requirements/database/database-design.md` — DB設計（20テーブル）
> - `docs/requirements/requirements-v2/*.md` — 画面要件定義 v2（26画面）
> - `docs/requirements/api/api-design.md` — API設計（本ドキュメント）
>
> 次のステップは **`/flow-build`** です。
> 設計成果物（`docs/requirements/**`）を唯一の仕様として参照し、実装フェーズを開始します。
