# セキュリティ監査レポート

> 監査日: 2026-04-09
> 対象ブランチ: fix/yamaki/login-session-time
> 目的: 本番環境デプロイに向けたセキュリティリスクの洗い出しと対応方針の策定

---

## 1. 監査サマリー

| 深刻度 | 件数 | ステータス |
|--------|------|-----------|
| CRITICAL | 4 | 未対応 |
| HIGH | 6 | 未対応 |
| MEDIUM | 6 | 未対応 |

**総合判定: 本番デプロイには CRITICAL 4件の解消が必須**

---

## 2. CRITICAL（デプロイ前に必ず修正）

### C-1: Cronエンドポイントが認証なしでアクセス可能

**対象ファイル:**
- `src/app/api/cron/clock-reminder/route.ts` (L12-15)
- `src/app/api/cron/closing-reminder/route.ts` (L12-15)
- `src/app/api/cron/weekly-schedule-reminder/route.ts` (L29-33)

**現状コード:**
```typescript
const secret = process.env.CRON_SECRET;
if (secret && authHeader !== `Bearer ${secret}`) {
  return unauthorized();
}
```

**なぜ危険か:**
- `CRON_SECRET` 環境変数が未設定の場合、`secret` は `undefined` になる
- `undefined && ...` は `false` になるため、if文が**スキップされる**
- 結果として、**認証なしで誰でもcronジョブを実行できる**
- 攻撃者がURLを知るだけで、Slack通知の大量送信やメール送信が可能
- Vercel Cronの場合、`/api/cron/*` というパス規則は推測しやすい

**修正方針:**
- 条件を反転し、secretが未設定の場合も拒否する
- `if (!secret || authHeader !== \`Bearer ${secret}\`) return unauthorized();`

**必要な操作:**
1. 3つのcronルートファイルの認証条件を修正（コード変更）
2. `.env.local` に `CRON_SECRET` を設定: `openssl rand -hex 32` で生成
3. 本番環境（Vercel等）の環境変数に同じ `CRON_SECRET` を設定

---

### C-2: レート制限なし（ブルートフォース攻撃に無防備）

**対象:** 全APIエンドポイント、特に以下が高リスク
- `POST /api/auth/sign-in/email` — ログイン
- `PUT /api/members/[id]/profile/password` — パスワード変更
- `POST /api/auth/sign-up/email` — アカウント作成

**なぜ危険か:**
- ログインエンドポイントに対してパスワード総当たり攻撃が可能
- 1秒間に数百〜数千回のリクエストを送信できる
- bcrypt 12ラウンドはハッシュ側の防御だが、試行回数の制限がなければ時間をかけて突破できる
- パスワード変更エンドポイントでは、現在のパスワードの推測に無制限に挑戦できる
- Credential Stuffing（漏洩パスワードリストによる攻撃）にも無防備

**修正方針:**
- Vercel Edge Middleware またはアプリ層でレート制限を実装
- 推奨パッケージ候補: カスタムミドルウェア（Map + タイムスタンプ） or Vercel KV を利用した分散レート制限
- ログイン: IP あたり 5回/15分
- パスワード変更: ユーザーあたり 3回/時

**必要な操作:**
1. レート制限ユーティリティの実装（`src/backend/rate-limit.ts`）
2. `src/middleware.ts` の作成（認証エンドポイントへの適用）
3. 動作確認

---

### C-3: セキュリティヘッダー未設定

**対象ファイル:** `next.config.js`

**現状:**
```javascript
const nextConfig = {
  outputFileTracingIncludes: {
    "/api/invoices/\\[invoiceId\\]/accounting": ["./src/backend/fonts/**/*"],
  },
};
```
セキュリティ関連のヘッダー設定が一切ない。

**なぜ危険か:**

| ヘッダー | 未設定時のリスク |
|---------|----------------|
| `Strict-Transport-Security` | ブラウザがHTTP接続を許容し、中間者攻撃（MITM）で通信を傍受・改竄される |
| `X-Frame-Options` | アプリが他サイトのiframeに埋め込まれ、クリックジャッキング攻撃で意図しない操作をさせられる |
| `X-Content-Type-Options` | ブラウザのMIMEスニッフィングにより、テキストファイルがスクリプトとして実行される |
| `Content-Security-Policy` | インラインスクリプトや外部スクリプトの注入（XSS）を防げない |
| `Referrer-Policy` | リファラーヘッダーから内部URLやトークンが外部サイトに漏洩する |
| `Permissions-Policy` | カメラ・マイク・位置情報等のブラウザAPIが無断で利用される |

**修正方針:**
- `next.config.js` の `headers()` で全ルートにセキュリティヘッダーを追加

**必要な操作:**
1. `next.config.js` にセキュリティヘッダー設定を追加（コード変更）
2. `npm run build` でビルドが通ることを確認
3. デプロイ後に https://securityheaders.com 等でヘッダーの反映を確認

---

### C-4: nodemailer の既知脆弱性（SMTPコマンドインジェクション）

**対象ファイル:** `package.json` (L28)
```json
"nodemailer": "^8.0.1"
```

**脆弱性:** GHSA-vvjj-xcjg-gr5g
- SMTP Transport名におけるCRLFインジェクション
- CVSS スコア: 4.9（Medium）
- 影響バージョン: <= 8.0.4

**なぜ危険か:**
- SMTPコマンドに任意の改行文字（CRLF）を注入できる
- 攻撃者がSMTPコマンドを挿入し、メール送信先の改竄や追加が可能
- 本アプリでは `src/backend/email.ts` でnodemailerを使用しており、締めリマインドや招待メール送信に影響する

**修正方針:**
- nodemailer を脆弱性修正済みバージョンにアップデート

**必要な操作:**
1. `npm audit` で現在の脆弱性を確認
2. `npm install nodemailer@latest` を実行
3. `npm audit` で脆弱性が解消されたことを確認
4. メール送信機能の動作確認

---

## 3. HIGH（早急に対応）

### H-1: middleware.ts が存在しない
- サーバーサイドのルート保護が欠落。認証チェックはクライアントサイド + 各APIルート個別に依存
- `src/middleware.ts` を作成し、`/api/auth` 以外の保護ルートへのアクセスをサーバーサイドで検証

### H-2: エラーレスポンスで内部情報が漏洩
- `src/app/api/evaluations/route.ts`, `src/app/api/skills/route.ts` 等で `String(e)` をそのまま返却
- スタックトレースやDB構造が外部に露出する。本番では汎用メッセージに差し替え

### H-3: 銀行口座情報が平文保存
- `prisma/schema.prisma` L217-221: `bankAccountNumber` 等が暗号化なしでDB保存
- TODOコメント（Phase 3）あるが、本番運用前に AES-256 暗号化を実装

### H-4: OAuthアクセストークンが平文保存
- `prisma/schema.prisma` L142-147: `accessToken`, `refreshToken` がDBに平文保存
- トークン漏洩時の影響（Google Calendar への不正アクセス）が大きい

### H-5: warmupエンドポイントに認証なし
- `src/app/api/warmup/route.ts`: 認証チェックなしでDBクエリを実行

### H-6: OAuth stateパラメータが予測可能
- `src/backend/google-calendar.ts` L22: `memberId` をstateに使用。CSRF防止には不十分

---

## 4. MEDIUM（本番運用前に対応推奨）

### M-1: ソースマップが本番ビルドに含まれる
- `next.config.js` に `productionBrowserSourceMaps: false` 未設定

### M-2: GETエンドポイントの認可不足
- `/api/members`, `/api/members/[id]/tools` 等 — 認証済みなら誰でも全データ閲覧可能

### M-3: 一部エンドポイントでZodバリデーション未使用
- contracts, invoices/generate 等で型アサーション(`as`)のみ

### M-4: デバッグエンドポイントが残存
- `/api/google/test` が環境変数の有無を返却

### M-5: ページネーション未実装のリスト系API
- `/api/members`, `/api/members/[id]/skills` 等で件数無制限

### M-6: console.error でのログ出力
- 構造化ロギング未導入。本番では適切なログ基盤が必要

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
