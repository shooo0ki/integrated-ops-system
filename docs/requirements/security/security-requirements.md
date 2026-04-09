# S-01 セキュリティ要件 — 実装済み仕様（確定版）

> 作成日: 2026-04-09（セキュリティ監査に基づき新規作成）
> 最終更新: 2026-04-09
> 参照元: security-audit.md（監査レポート）、critical-fix-guide.md（修正ガイド）

---

## 概要

本番環境にデプロイするアプリケーションとして必要なセキュリティ対策の要件定義。
認証・認可・通信保護・入力検証・攻撃緩和の各レイヤーについて、実装済みの仕様を記載する。

---

## 1. 認証（Authentication）

### 1-1. セッション管理

| 項目 | 仕様 |
|------|------|
| フレームワーク | Better Auth v1.4.5 |
| セッション有効期限 | 24 時間 |
| セッション更新間隔 | 1 時間 |
| Cookie プレフィックス | `salt2` |
| Cookie キャッシュ | 有効（最大 1 分） |
| セッション保存先 | PostgreSQL `ba_sessions` テーブル |
| 記録情報 | IP アドレス、User-Agent、作成日時、更新日時 |

**関連ファイル:**
- `src/backend/auth.ts` — Better Auth 設定
- `prisma/schema.prisma` — `BaSession` テーブル定義

### 1-2. パスワードポリシー

| 項目 | 仕様 |
|------|------|
| 最小文字数 | 8 文字 |
| ハッシュアルゴリズム | bcryptjs |
| ストレッチング回数 | 12 ラウンド |
| 保存形式 | ハッシュ値のみ（平文は保持しない） |

**関連ファイル:**
- `src/backend/auth.ts` (L35-42) — パスワード設定
- `src/app/api/members/[id]/profile/password/route.ts` — パスワード変更エンドポイント

### 1-3. 認証シークレット

| 項目 | 仕様 |
|------|------|
| `BETTER_AUTH_SECRET` | 32 文字以上の暗号的に安全な文字列（必須） |
| 起動時バリデーション | `validateAuthSecret()` により文字数を検証。不足時はエラーで起動停止 |

**関連ファイル:**
- `src/backend/auth.ts` (L18-28) — バリデーション関数

---

## 2. ルート保護（Route Protection）

### 2-1. サーバーサイド保護（proxy）

Next.js 16 の proxy 機構により、全リクエストをサーバーサイドで検査する。

| ルート | 保護 |
|-------|------|
| `/login`, `/api/auth/*`, `/_next/*`, `/favicon.ico` | 公開（認証不要） |
| `/api/warmup`, `/api/cron/*`, `/api/admin/*` | 公開（各エンドポイント内で `CRON_SECRET` 認証） |
| 上記以外 | `salt2.session_token` Cookie の存在を確認。未認証時はログイン画面にリダイレクト |

**関連ファイル:**
- `src/proxy.ts` — ルート保護 + レート制限

### 2-2. API エンドポイント認可

全 API ルートで `getSessionUser()` による認証チェックを実施。
ロールベースアクセス制御（RBAC）を各エンドポイントに適用。

| ロール | 権限 |
|-------|------|
| `admin` | 全操作 |
| `manager` | メンバー管理・プロジェクト管理等の書き込み操作 |
| `member` | 自身のデータの閲覧・編集のみ |

**パターン:**
```typescript
const user = await getSessionUser();
if (!user) return unauthorized();                    // 認証
if (!["admin", "manager"].includes(user.role)) return forbidden(); // 認可
```

---

## 3. 攻撃緩和（Attack Mitigation）

### 3-1. レート制限

`src/proxy.ts` にてインメモリのレート制限を実施。制限超過時は `429 Too Many Requests` を返却。

| 対象パス | 制限 | ウィンドウ |
|---------|------|----------|
| `POST /api/auth/sign-in/*` | IP あたり 5 回 | 15 分 |
| `POST /api/auth/sign-up/*` | IP あたり 3 回 | 15 分 |
| `PUT /api/members/*/profile/password` | IP あたり 3 回 | 60 分 |

**制限事項:** インメモリ実装のため Vercel Serverless のインスタンス間では共有されない。

**関連ファイル:**
- `src/backend/rate-limit.ts` — レート制限ロジック
- `src/proxy.ts` — 適用箇所

### 3-2. Cron / Warmup エンドポイント認証

全 cron エンドポイントおよび warmup エンドポイントで `CRON_SECRET` による Bearer トークン認証を必須化。
環境変数が未設定の場合もリクエストを拒否する。

```typescript
const secret = process.env.CRON_SECRET;
if (!secret || authHeader !== `Bearer ${secret}`) {
  return unauthorized();
}
```

| エンドポイント | 用途 |
|--------------|------|
| `GET /api/cron/clock-reminder` | 出勤打刻リマインド |
| `GET /api/cron/closing-reminder` | 月次締めリマインド |
| `GET /api/cron/weekly-schedule-reminder` | 週次勤務予定リマインド |
| `GET /api/warmup` | DB コネクションプール初期化 |

**関連ファイル:**
- `src/app/api/cron/clock-reminder/route.ts`
- `src/app/api/cron/closing-reminder/route.ts`
- `src/app/api/cron/weekly-schedule-reminder/route.ts`
- `src/app/api/warmup/route.ts`

### 3-3. OAuth CSRF 対策（state パラメータ）

Google OAuth フローで CSRF 攻撃を防止するため、暗号的に安全なランダム state を使用する。

```
認証開始 → crypto.randomBytes(32) で state を生成
         → state:memberId を httpOnly Cookie に保存（5分有効）
         → Google に state 付きで遷移

コールバック → Google から返された state と Cookie の state を照合
             → memberId も Cookie から復元し、ログインユーザーと一致するか検証
             → 検証後 Cookie を削除
```

**関連ファイル:**
- `src/backend/google-calendar.ts` — `getAuthUrl()` でランダム state 生成
- `src/app/api/google/auth/route.ts` — Cookie 保存
- `src/app/api/google/callback/route.ts` — Cookie 検証・削除

### 3-4. Webhook 署名検証

DocuSign Webhook は HMAC-SHA256 による署名検証を実施。

```
リクエスト → x-docusign-signature-1 ヘッダーを取得
           → DOCUSIGN_WEBHOOK_SECRET で HMAC-SHA256 を計算
           → 署名が一致しなければ 401 を返却
```

**関連ファイル:**
- `src/app/api/webhooks/docusign/route.ts` — 署名検証
- `src/backend/docusign.ts` — `verifyWebhookSignature()`

---

### 3-5. エラーレスポンスの情報秘匿

API エンドポイントの catch ブロックで例外の詳細をクライアントに返さない。
サーバーサイドには `console.error` でログを残しつつ、レスポンスは汎用メッセージのみとする。

```typescript
// OK: 汎用メッセージ
return apiError("INTERNAL_ERROR", "サーバーエラーが発生しました", 500);

// NG: 内部情報の漏洩
return apiError("INTERNAL_ERROR", String(e), 500);
```

### 3-6. デバッグエンドポイントの排除

本番環境に不要なテスト・デバッグ用エンドポイントは設置しない。
環境変数の有無や内部状態を返すエンドポイントは情報漏洩のリスクとなる。

---

## 4. 通信保護（Transport Security）

### 4-1. セキュリティヘッダー

`next.config.js` の `headers()` により全ルートに以下のヘッダーを付与。

| ヘッダー | 値 | 目的 |
|---------|---|------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | HTTPS 強制 |
| `X-Frame-Options` | `DENY` | クリックジャッキング防止 |
| `X-Content-Type-Options` | `nosniff` | MIME スニッフィング防止 |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | リファラー漏洩防止 |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | ブラウザ API 制限 |
| `X-DNS-Prefetch-Control` | `on` | DNS プリフェッチ有効化 |

**関連ファイル:**
- `next.config.js` — ヘッダー設定

### 4-2. ソースマップ

本番ビルドではブラウザ向けソースマップを無効化し、ソースコードの解析を防止する。

```javascript
// next.config.js
productionBrowserSourceMaps: false,
```

**関連ファイル:**
- `next.config.js`

---

## 5. データ暗号化（Encryption at Rest）

### 5-1. 暗号化アルゴリズム

AES-256-GCM による認証付き暗号化を採用。

| 項目 | 仕様 |
|------|------|
| アルゴリズム | AES-256-GCM |
| 鍵長 | 256 bit（環境変数 `ENCRYPTION_KEY` = 64文字 hex） |
| IV（初期化ベクトル） | 12バイト、毎回 `crypto.randomBytes()` で生成 |
| 認証タグ | 16バイト（GCM が自動生成、改竄検知に使用） |
| 保存形式 | `enc:<base64(iv + authTag + ciphertext)>` |
| デュアルリード | `enc:` プレフィックスがなければ平文として読み取り（移行期間対応） |

### 5-2. 暗号化対象

| データ | カラム | 対象テーブル |
|-------|--------|------------|
| 銀行口座情報 | `bankName`, `bankBranch`, `bankAccountNumber`, `bankAccountHolder` | `members` |
| OAuth トークン | `accessToken`, `refreshToken` | `google_tokens` |

### 5-3. 鍵管理

| 項目 | 仕様 |
|------|------|
| 鍵の保管 | Vercel 環境変数 + パスワードマネージャー等で安全にバックアップ |
| 鍵のローテーション | 現時点では未対応（将来的に再暗号化スクリプトで対応可能） |
| 鍵紛失時 | 暗号化データは復元不能。バックアップ必須 |

**関連ファイル:**
- `src/backend/crypto.ts` — 暗号化/復号ユーティリティ
- `src/app/api/admin/encrypt-migration/route.ts` — 既存データ暗号化エンドポイント（本番移行完了後に削除予定）

---

## 6. 入力検証（Input Validation）

### 6-1. サーバーサイドバリデーション

主要エンドポイントで Zod スキーマによるバリデーションを実施。

| スキーマ | 対象 | 主な制約 |
|---------|------|---------|
| `createMemberSchema` | メンバー作成 | name: max 100, email: format, phone: max 20 |
| `updateMemberSchema` | メンバー更新 | 同上（部分更新対応） |
| `createProjectSchema` | プロジェクト作成 | company: enum, name: max 200 |
| `updateProjectSchema` | プロジェクト更新 | 同上（部分更新対応） |

**関連ファイル:**
- `src/backend/validations/member.ts`
- `src/backend/validations/project.ts`
- `src/backend/validations/skill.ts`

### 6-2. SQL インジェクション対策

Prisma ORM によるパラメタライズドクエリを全面採用。
生 SQL は `src/app/api/warmup/route.ts` の `SELECT 1` のみ（ユーザー入力を含まない）。

---

## 7. フロントエンドセキュリティ

| 項目 | 仕様 |
|------|------|
| XSS 対策 | `dangerouslySetInnerHTML` 不使用。React 標準のエスケープに依拠 |
| クライアント環境変数 | `NEXT_PUBLIC_APP_URL` のみ公開。機密情報はサーバーサイドに限定 |
| クライアントストレージ | `localStorage` / `sessionStorage` に機密データを保存しない |
| Cookie | `httpOnly`, `secure` フラグ付き（Better Auth が自動設定） |
| 外部スクリプト | CDN からのサードパーティスクリプト読み込みなし |
| 銀行口座表示 | 口座番号は下 4 桁のみ表示（マスキング） |

**関連ファイル:**
- `src/frontend/lib/auth-client.ts` — クライアント認証設定
- `src/frontend/contexts/auth-context.tsx` — セッション管理
- `src/frontend/contexts/swr-provider.tsx` — SWR フェッチャー（`credentials: "same-origin"`, `cache: "no-store"`）

---

## 8. 監査ログ

機密操作は `auditLog` テーブルに記録。

| 記録項目 | 説明 |
|---------|------|
| `action` | 操作種別（作成・更新・削除等） |
| `targetType` / `targetId` | 操作対象のエンティティ |
| `actorId` | 操作者の member ID |
| `ipAddress` | リクエスト元 IP |
| `detail` | 操作の詳細（JSON） |
| `createdAt` | 操作日時 |

**関連ファイル:**
- `prisma/schema.prisma` — `AuditLog` テーブル定義

---

## 9. 環境変数一覧（セキュリティ関連）

| 変数名 | 必須 | 用途 |
|--------|------|------|
| `BETTER_AUTH_SECRET` | 必須 | セッション暗号化キー（32 文字以上） |
| `BETTER_AUTH_URL` | 必須 | Better Auth のベースURL（本番: `https://app.example.com`） |
| `ENCRYPTION_KEY` | 必須 | データ暗号化キー（64文字 hex = 32バイト）。変更不可 |
| `CRON_SECRET` | 必須 | Cron エンドポイント認証トークン |
| `DATABASE_URL` | 必須 | DB 接続文字列 |
| `DOCUSIGN_WEBHOOK_SECRET` | 任意 | Webhook 署名検証キー |
| `SLACK_BOT_TOKEN` | 任意 | Slack API トークン |
| `GOOGLE_CLIENT_ID` | 任意 | Google OAuth クライアント ID |
| `GOOGLE_CLIENT_SECRET` | 任意 | Google OAuth クライアントシークレット |

生成方法: `openssl rand -base64 32`（SECRET 系）、`openssl rand -hex 32`（TOKEN 系）

---

## 10. 未対応事項（今後の対応予定）

| 項目 | 深刻度 | 対応予定 | 参照 |
|------|--------|---------|------|
| GET エンドポイントの認可強化 | MEDIUM | 次スプリント | security-audit.md M-2 |
| 一部エンドポイントの Zod バリデーション追加 | MEDIUM | 次スプリント | security-audit.md M-3 |
| リスト系 API のページネーション | MEDIUM | 次スプリント | security-audit.md M-5 |
| 構造化ロギングの導入 | MEDIUM | 次スプリント | security-audit.md M-6 |
