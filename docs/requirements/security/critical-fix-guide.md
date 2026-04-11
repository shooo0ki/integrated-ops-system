# CRITICAL セキュリティ修正ガイド

> 本ドキュメントは各 CRITICAL 項目について「なぜ危険か」「どう修正するか」「操作手順」をまとめたものです。

---

## C-1: Cronエンドポイントの認証必須化

### 攻撃シナリオ

```
攻撃者 → GET /api/cron/clock-reminder (Authorization ヘッダーなし)
          ↓
  CRON_SECRET 未設定 → secret = undefined
  if (undefined && ...) → false → 認証スキップ
          ↓
  全メンバーの勤務状況を取得 → Slack通知が大量送信される
```

### 修正内容

**修正前（3ファイル共通）:**
```typescript
const secret = process.env.CRON_SECRET;
if (secret && authHeader !== `Bearer ${secret}`) {
  return unauthorized();
}
```

**修正後:**
```typescript
const secret = process.env.CRON_SECRET;
if (!secret || authHeader !== `Bearer ${secret}`) {
  return unauthorized();
}
```

### 対象ファイル
| ファイル | 修正箇所 |
|---------|---------|
| `src/app/api/cron/clock-reminder/route.ts` | L12-15 |
| `src/app/api/cron/closing-reminder/route.ts` | L12-15 |
| `src/app/api/cron/weekly-schedule-reminder/route.ts` | L29-33 |

### 操作手順

1. **コード修正**: 上記3ファイルの条件を変更（Claude が実施）
2. **環境変数設定（ユーザーが実施）**:
   ```bash
   # シークレットを生成
   openssl rand -hex 32

   # .env.local に追記（生成した値を貼り付け）
   echo 'CRON_SECRET="ここに生成した値"' >> .env.local
   ```
3. **本番環境**: Vercel ダッシュボード → Settings → Environment Variables に `CRON_SECRET` を追加
4. **Vercel Cron 設定**: `vercel.json` の cron 設定がある場合、Vercel は自動で `Authorization: Bearer <CRON_SECRET>` を付与する

---

## C-2: レート制限の導入

### 攻撃シナリオ

```
攻撃者 → POST /api/auth/sign-in/email
          { email: "target@example.com", password: "attempt-1" }
          { email: "target@example.com", password: "attempt-2" }
          ... （1秒間に1000回）
          ↓
  現状: すべてのリクエストが処理される
  bcrypt 12ラウンドで1回 ≈ 250ms → 並列処理で秒間数件は突破試行可能
```

### 修正内容

**新規ファイル `src/backend/rate-limit.ts`:**
- インメモリ Map でIPアドレスごとのリクエスト回数を追跡
- 設定可能なウィンドウ（時間枠）と最大試行回数
- Vercel Serverless では各関数インスタンスごとのメモリなので完全ではないが、基本的な防御として有効

**新規ファイル `src/middleware.ts`:**
- `/api/auth/sign-in`, `/api/auth/sign-up` へのPOSTリクエストにレート制限を適用
- 制限超過時は `429 Too Many Requests` を返却

### 対象パスと制限値
| パス | 制限 | ウィンドウ |
|-----|------|----------|
| `POST /api/auth/sign-in/*` | 5回 | 15分 |
| `POST /api/auth/sign-up/*` | 3回 | 15分 |
| `PUT /api/members/*/profile/password` | 3回 | 60分 |

### 操作手順

1. **コード追加**: `src/backend/rate-limit.ts` と `src/middleware.ts` を作成（Claude が実施）
2. **動作確認（ユーザーが実施）**:
   ```bash
   npm run dev
   # ログイン画面で意図的に6回連続で間違えて 429 が返ることを確認
   ```
3. **将来的な強化（任意）**: Vercel KV や Redis ベースの分散レート制限に移行

---

## C-3: セキュリティヘッダーの設定

### 攻撃シナリオ（クリックジャッキングの例）

```
攻撃者のサイト:
  <iframe src="https://salt2-ops.example.com/members/delete/123"
          style="opacity: 0; position: absolute; top: 0;">
  </iframe>
  <button style="position: absolute; top: 0;">
    ここをクリックして景品GET!
  </button>

→ ユーザーがボタンをクリックすると、透明なiframe内のdeleteが実行される
→ X-Frame-Options: DENY があればブラウザがiframe埋め込みを拒否
```

### 修正内容

**`next.config.js` に `headers()` を追加:**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    "/api/invoices/\\[invoiceId\\]/accounting": ["./src/backend/fonts/**/*"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
```

### 各ヘッダーの役割

| ヘッダー | 値 | 防ぐ攻撃 |
|---------|---|---------|
| `X-Frame-Options` | `DENY` | クリックジャッキング（iframe埋め込み） |
| `X-Content-Type-Options` | `nosniff` | MIMEスニッフィングによるスクリプト実行 |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | リファラーからの情報漏洩 |
| `Permissions-Policy` | `camera=(), microphone=()...` | ブラウザAPIの無断利用 |
| `Strict-Transport-Security` | `max-age=31536000` | HTTPS強制（HTTP接続を拒否） |
| `X-DNS-Prefetch-Control` | `on` | DNS先読みによるパフォーマンス向上 |

### 操作手順

1. **コード修正**: `next.config.js` を更新（Claude が実施）
2. **ビルド確認（ユーザーが実施）**:
   ```bash
   npm run build
   ```
3. **ヘッダー反映確認（デプロイ後）**:
   ```bash
   curl -I https://your-app-url.vercel.app
   # 上記ヘッダーが全て含まれていることを確認
   ```
4. **外部ツールで検証（任意）**: https://securityheaders.com にURLを入力して評価

---

## C-4: nodemailer の脆弱性修正

### 攻撃シナリオ

```
攻撃者 → メールアドレスに CRLF を含む値を送信
          例: "attacker@evil.com\r\nRCPT TO:<victim@example.com>"
          ↓
  nodemailer が SMTP コマンドとしてそのまま送信
          ↓
  意図しない宛先にメールが送られる / SMTPサーバーが不正なコマンドを実行
```

**本アプリでの影響箇所:**
- `src/backend/email.ts`: 締めリマインド・招待メール等の送信
- `src/app/api/cron/closing-reminder/route.ts`: メンバーのメールアドレスを使用
- メールアドレスはDBから取得するため、直接の攻撃リスクは低いが、DBに不正な値が入った場合に影響

### 操作手順

**ユーザーが実施:**

```bash
# 1. 現在の脆弱性を確認
npm audit

# 2. nodemailer をアップデート
npm install nodemailer@latest

# 3. 型定義もアップデート
npm install -D @types/nodemailer@latest

# 4. 脆弱性が解消されたことを確認
npm audit

# 5. ビルドが通ることを確認
npm run build
```

---

## 修正の優先順位と依存関係

```
C-4 (npm install のみ)     ← 最も簡単、まず実施
  ↓
C-1 (3ファイル修正 + 環境変数) ← コード変更は小さい
  ↓
C-3 (next.config.js 修正)  ← ビルド確認が必要
  ↓
C-2 (新規ファイル2つ作成)   ← 最も作業量が多い
```

### チェックリスト

- [ ] C-4: `npm install nodemailer@latest` を実行
- [ ] C-4: `npm audit` で脆弱性 0 を確認
- [ ] C-1: 3つの cron ルートの認証条件を修正
- [ ] C-1: `CRON_SECRET` を `.env.local` に設定
- [ ] C-1: 本番環境の環境変数に `CRON_SECRET` を追加
- [ ] C-3: `next.config.js` にセキュリティヘッダーを追加
- [ ] C-3: `npm run build` が成功することを確認
- [ ] C-2: レート制限ユーティリティを作成
- [ ] C-2: `src/middleware.ts` を作成
- [ ] C-2: ログイン画面で429応答を確認
