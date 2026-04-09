# セキュリティ監査レポート

> 監査日: 2026-04-09
> 対象ブランチ: fix/yamaki/login-session-time
> 目的: 本番環境デプロイに向けたセキュリティリスクの洗い出しと対応方針の策定

---

## 1. 監査サマリー

| 深刻度 | 件数 | ステータス |
|--------|------|-----------|
| CRITICAL | 4 | **全件対応済み (2026-04-09)** |
| HIGH | 6 | **全件対応済み (2026-04-09)** |
| MEDIUM | 6 | **全件対応済み (2026-04-09)** |

**総合判定: CRITICAL 全件 + HIGH 全件 + MEDIUM 2件を解消済み。残課題はバリデーション強化等（M-2, M-3, M-5, M-6）**

---

## 2. CRITICAL（デプロイ前に必ず修正）

### C-1: Cronエンドポイントが認証なしでアクセス可能 — **対応済み**

> **修正日:** 2026-04-09
> **修正内容:** 3ファイルの認証条件を `secret && ...` → `!secret || ...` に変更。`.env.example` を必須に更新。

**対象ファイル:**
- `src/app/api/cron/clock-reminder/route.ts` (L12-15)
- `src/app/api/cron/closing-reminder/route.ts` (L12-15)
- `src/app/api/cron/weekly-schedule-reminder/route.ts` (L29-33)

**なぜ危険だったか:**
- `CRON_SECRET` 環境変数が未設定の場合、`secret` は `undefined` になる
- `undefined && ...` は `false` になるため、if文が**スキップされる**
- 結果として、**認証なしで誰でもcronジョブを実行できる**
- 攻撃者がURLを知るだけで、Slack通知の大量送信やメール送信が可能

**修正後コード:**
```typescript
const secret = process.env.CRON_SECRET;
if (!secret || authHeader !== `Bearer ${secret}`) {
  return unauthorized();
}
```

**残作業（本番デプロイ時）:**
- 本番環境（Vercel等）の環境変数に `CRON_SECRET` を設定すること

---

### C-2: レート制限なし（ブルートフォース攻撃に無防備） — **対応済み**

> **修正日:** 2026-04-09
> **修正内容:** `src/backend/rate-limit.ts` を新規作成し、`src/proxy.ts` にレート制限を組み込み。

**なぜ危険だったか:**
- ログインエンドポイントに対してパスワード総当たり攻撃が可能
- パスワード変更エンドポイントで現在のパスワードの推測に無制限に挑戦できた
- Credential Stuffing（漏洩パスワードリストによる攻撃）にも無防備だった

**適用ルール:**
| パス | 制限 | ウィンドウ |
|-----|------|----------|
| `POST /api/auth/sign-in/*` | IP あたり 5回 | 15分 |
| `POST /api/auth/sign-up/*` | IP あたり 3回 | 15分 |
| `PUT /api/members/*/profile/password` | IP あたり 3回 | 60分 |

**制限事項:**
- インメモリ実装のため、Vercel Serverless の各インスタンス間では共有されない
- 将来的に Vercel KV や Redis ベースの分散レート制限への移行を推奨

---

### C-3: セキュリティヘッダー未設定 — **対応済み**

> **修正日:** 2026-04-09
> **修正内容:** `next.config.js` の `headers()` で全ルートに6種のセキュリティヘッダーを追加。

**なぜ危険だったか:**

| ヘッダー | 未設定時のリスク |
|---------|----------------|
| `Strict-Transport-Security` | 中間者攻撃（MITM）で通信を傍受・改竄される |
| `X-Frame-Options` | クリックジャッキング攻撃で意図しない操作をさせられる |
| `X-Content-Type-Options` | MIMEスニッフィングによりスクリプトが実行される |
| `Referrer-Policy` | リファラーから内部URLやトークンが漏洩する |
| `Permissions-Policy` | カメラ・マイク等のブラウザAPIが無断利用される |

**追加したヘッダー:**
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-DNS-Prefetch-Control: on`

**残作業（デプロイ後）:**
- https://securityheaders.com 等でヘッダーの反映を確認

---

### C-4: nodemailer の既知脆弱性（SMTPコマンドインジェクション） — **対応済み**

> **修正日:** 2026-04-09
> **修正内容:** `npm audit fix` により nodemailer を脆弱性修正済みバージョンにアップデート。`npm audit` で脆弱性 0 件を確認。

**脆弱性:** GHSA-vvjj-xcjg-gr5g
- SMTP Transport名におけるCRLFインジェクション
- CVSS スコア: 4.9（Medium）
- 影響バージョン: <= 8.0.4

**なぜ危険だったか:**
- SMTPコマンドに任意の改行文字（CRLF）を注入できる
- 攻撃者がSMTPコマンドを挿入し、メール送信先の改竄や追加が可能

---

## 3. HIGH（早急に対応）

### H-1: サーバーサイドのルート保護 — **対応済み（C-2 で解消）**
- Next.js 16 推奨の `src/proxy.ts` にてセッションCookieチェック + レート制限を実装済み

### H-2: エラーレスポンスで内部情報が漏洩 — **対応済み**

> **修正日:** 2026-04-09
> **修正内容:** 4箇所の `String(e)` / `e.message` を汎用メッセージに差し替え。`console.error` によるサーバーサイドログは維持。
>
> 修正ファイル: `evaluations/route.ts`, `skills/route.ts`, `invoices/[invoiceId]/accounting/route.ts`

### H-3: 銀行口座情報が平文保存 — **対応済み**

> **修正日:** 2026-04-09
> **修正内容:** `src/backend/crypto.ts` に AES-256-GCM 暗号化/復号ユーティリティを作成。書き込み時に `encryptBankFields()`、読み取り時に `decryptBankFields()` を適用。デュアルリード対応（平文/暗号文を自動判別）。
> 既存データのマイグレーション: `GET /api/admin/encrypt-migration` エンドポイント（本番移行完了後に削除予定）

### H-4: OAuthアクセストークンが平文保存 — **対応済み**

> **修正日:** 2026-04-09
> **修正内容:** `src/backend/google-calendar.ts` のトークン読み書き箇所に `encrypt()` / `decrypt()` を適用。H-3 と同じ暗号化基盤を使用。

### H-5: warmupエンドポイントに認証なし — **対応済み**

> **修正日:** 2026-04-09
> **修正内容:** `CRON_SECRET` による Bearer トークン認証を追加（Cron エンドポイントと同じパターン）。

### H-6: OAuth stateパラメータが予測可能 — **対応済み**

> **修正日:** 2026-04-09
> **修正内容:** `getAuthUrl()` を暗号的ランダム state（`crypto.randomBytes(32)`）に変更。state と memberId の対応は httpOnly Cookie（5分有効）で管理し、callback で照合。
>
> 修正ファイル: `google-calendar.ts`, `google/auth/route.ts`, `google/callback/route.ts`

---

## 4. MEDIUM（本番運用前に対応推奨）

### M-1: ソースマップが本番ビルドに含まれる — **対応済み**

> **修正日:** 2026-04-09
> **修正内容:** `next.config.js` に `productionBrowserSourceMaps: false` を追加。

### M-2: GETエンドポイントの認可不足 — **対応済み**

> **修正日:** 2026-04-09
> **修正内容:** `/api/members/[id]/tools` と `/api/members/[id]/skills` の GET に「本人または admin/manager」のロールチェックを追加。メンバー一覧・プロジェクト一覧は業務上全ユーザーが閲覧するため制限不要と判断。

### M-3: 一部エンドポイントでZodバリデーション未使用 — **対応済み**

> **修正日:** 2026-04-09
> **修正内容:** `contracts/route.ts` と `invoices/generate/route.ts` の POST ハンドラで `as` 型アサーションを Zod スキーマに置き換え。金額上限（99,999,999）も追加。

### M-4: デバッグエンドポイントが残存 — **対応済み**

> **修正日:** 2026-04-09
> **修正内容:** `src/app/api/google/test/` ディレクトリごと削除。他からの参照なしを確認済み。

### M-5: ページネーション未実装のリスト系API — **対応済み**

> **修正日:** 2026-04-09
> **修正内容:** `/api/members` に `limit`/`offset` パラメータ（最大200件）を追加。`/api/members/[id]/skills` に `take: 500` を追加。

### M-6: console.error でのログ出力 — **対応済み**

> **修正日:** 2026-04-09
> **修正内容:** `src/backend/logger.ts` を新規作成（JSON 構造化ログ）。API ルート・バックエンドの全 `console.error`（10箇所）を `logger.error` / `logger.warn` に置換。

---

## 5. 対応済み（良好な実装）

| 項目 | 状況 |
|------|------|
| パスワードハッシュ | bcryptjs 12ラウンド |
| セッション管理 | 24h有効期限、DB保存、IP/UserAgent記録 |
| SQLインジェクション対策 | Prisma ORMによるパラメタライズドクエリ |
| XSS対策 | dangerouslySetInnerHTML 不使用、React標準エスケープ |
| 機密情報の分離 | NEXT_PUBLIC_ は APP_URL のみ、.env は .gitignore に含む |
| Webhook署名検証 | DocuSign HMAC-SHA256 で検証済み |
| 監査ログ | auditLog テーブルで操作記録 |
| localStorage不使用 | 機密データはCookie/メモリのみ |
