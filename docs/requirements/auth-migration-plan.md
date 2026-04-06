# 認証基盤移行計画: iron-session → Better Auth

> 作成日: 2026-04-06
> ブランチ: `fix/yamaki/login-session-time`
> ステータス: 設計レビュー中

---

## 1. 目的

iron-session (セッション管理のみ) から Better Auth (認証フレームワーク) に移行し、
自前実装に依存していたセキュリティ要件をフレームワーク側に委譲する。

### 移行で解決する問題

| 問題 | 現状 (iron-session) | 移行後 (Better Auth) |
|------|---------------------|---------------------|
| セッション即時無効化不可 | ステートレス Cookie → 他端末で無効化できない | DB セッション → 即時無効化可能 |
| レート制限なし | 自前実装が必要 | プラグインで提供 |
| 監査ログなし | 自前実装が必要 | フック機能で対応 |
| ハードコード秘密鍵 | fallback が本番に漏れるリスク | 環境変数必須 |
| セッション TTL 7日 (要件は24h) | 設定ミス | 設定で明示 |
| 将来の 2FA 対応 | 全て自前 | プラグイン追加のみ |

---

## 2. DB への影響 (本番統合時の操作)

### 2a. 追加されるテーブル (Better Auth 必須)

Better Auth は以下の4テーブルを要求する:

| テーブル | 用途 | 既存テーブルとの関係 |
|----------|------|---------------------|
| `ba_session` | DB セッション管理 | **新規** — 既存にはセッションテーブルなし |
| `ba_account` | 認証プロバイダ情報 (email/password) | `user_accounts.password_hash` の役割を引き継ぐ |
| `ba_user` | Better Auth のユーザーマスタ | 既存 `user_accounts` と **1:1 で紐付け** |
| `ba_verification` | メール検証・パスワードリセット用トークン | **新規** |

> テーブル名に `ba_` プレフィックスを付けて既存テーブルとの衝突を回避する。
> Better Auth は Prisma の `@@map()` によるテーブル名カスタマイズに対応している。

### 2b. 既存テーブルへの変更

| テーブル | 変更 | 内容 |
|----------|------|------|
| `user_accounts` | **変更なし** | そのまま残す。`ba_user.id` → `user_accounts.id` のマッピングで参照 |
| `members` | **変更なし** | 既存のリレーションは全て維持 |

### 2c. 本番デプロイ時に必要な DB 操作

```
1. prisma migrate deploy        ← 新テーブル4つを作成
2. データ移行スクリプト実行       ← 既存 user_accounts → ba_user + ba_account にコピー
3. アプリケーションデプロイ       ← Better Auth 対応コードに切替
```

**ロールバック手順:**
- ba_* テーブルを削除するだけで旧コードに戻せる
- 既存テーブルには一切変更を加えないため、ロールバックリスクは低い

### 2d. データ移行スクリプトの内容

```
既存: user_accounts (id, email, password_hash, role, member_id)
                ↓
新規: ba_user    (id = user_accounts.id, email, name = members.name)
      ba_account (userId = ba_user.id, providerId = "credential", password_hash をコピー)
```

- `ba_user.id` を `user_accounts.id` と同一にすることで、
  既存の全リレーション (createdProjects, auditLogs 等) を壊さない
- `user_accounts` テーブル自体は削除しない (role, member_id の参照元として維持)

---

## 3. 変更対象ファイル

### 全面書き換え

| ファイル | 変更内容 |
|----------|---------|
| `src/backend/auth.ts` | Better Auth 設定 (Prisma adapter, emailAndPassword, session TTL) |
| `src/app/api/auth/[...all]/route.ts` | Better Auth のキャッチオールハンドラ (login/logout/session を統合) |
| `src/frontend/contexts/auth-context.tsx` | Better Auth クライアント (`createAuthClient`) に置換 |
| `src/app/(unauthenticated)/login/page.tsx` | `authClient.signIn.email()` を使用 |

### 削除

| ファイル | 理由 |
|----------|------|
| `src/app/api/auth/login/route.ts` | キャッチオールハンドラに統合 |
| `src/app/api/auth/logout/route.ts` | 同上 |
| `src/app/api/auth/session/route.ts` | 同上 |

### 修正 (小規模)

| ファイル | 変更内容 |
|----------|---------|
| `src/app/(authenticated)/layout.tsx` | セッションチェックを Better Auth クライアントに変更 |
| `prisma/schema.prisma` | Better Auth 用 4モデル追加 |
| `.env.example` | `SESSION_SECRET` → `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` 追加 |
| `package.json` | `better-auth` 追加, `iron-session` 削除 |

### 変更不要

| ファイル群 | 理由 |
|-----------|------|
| `src/app/api/**` (auth 以外の全 API Route) | `getSessionUser()` のインターフェース (返り値の型) を維持するため |
| `src/backend/slack.ts, db.ts, etc.` | 認証と無関係 |
| `src/frontend/components/**` | 認証と無関係 |
| `src/app/(authenticated)/**/page.tsx` | 各ページは変更不要 |

---

## 4. `getSessionUser()` 互換レイヤー

**最重要ポイント**: 既存 API Route (68本) は全て `getSessionUser()` を呼んでいる。
この関数の返り値の型を変えなければ、auth 以外のコードは一切変更不要。

```typescript
// 移行後の src/backend/auth.ts (イメージ)
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  session: {
    expiresIn: 60 * 60 * 24,    // 24時間 (要件通り)
    updateAge: 60 * 60,          // 1時間ごとにセッション更新
  },
});

// ---- 互換レイヤー (既存コードへの影響をゼロにする) ----

export type AppRole = "admin" | "manager" | "member";

export interface SessionUser {
  id: string;       // UserAccount.id
  memberId: string; // Member.id
  email: string;
  role: AppRole;
  name: string;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  // Better Auth のセッション取得
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  // ba_user.id === user_accounts.id なので、そのまま引ける
  const account = await prisma.userAccount.findUnique({
    where: { id: session.user.id },
  });
  if (!account) return null;

  return {
    id: account.id,
    memberId: account.memberId,
    email: account.email,
    role: account.role as AppRole,
    name: session.user.name,
  };
}
```

---

## 5. 実装ステップ

### Phase 0: 即時修正 (Better Auth 移行前でも実施)

| # | 作業 | リスク |
|---|------|--------|
| 0-1 | `auth.ts` の TTL を 7日 → 24時間に変更 | なし |
| 0-2 | ハードコード秘密鍵 fallback を削除 | SESSION_SECRET 未設定だと起動不可になる (意図的) |

### Phase 1: Better Auth 導入 + DB マイグレーション

| # | 作業 | 確認方法 |
|---|------|---------|
| 1-1 | `better-auth` パッケージ追加, `iron-session` 削除 | `npm install` 成功 |
| 1-2 | `prisma/schema.prisma` に 4モデル追加 | `npx prisma validate` 成功 |
| 1-3 | マイグレーション作成・実行 | `npx prisma migrate dev` 成功 |
| 1-4 | データ移行スクリプト作成 (`prisma/migrate-auth.ts`) | ローカル DB で実行確認 |

### Phase 2: サーバーサイド移行

| # | 作業 | 確認方法 |
|---|------|---------|
| 2-1 | `src/backend/auth.ts` を Better Auth 設定に書き換え | 型エラーなし |
| 2-2 | `src/app/api/auth/[...all]/route.ts` 作成 | `/api/auth/sign-in/email` にPOSTでログイン成功 |
| 2-3 | 旧 auth API Route 3ファイル削除 | ビルド成功 |
| 2-4 | `getSessionUser()` 互換レイヤー動作確認 | 既存 API Route が全て正常動作 |

### Phase 3: クライアントサイド移行

| # | 作業 | 確認方法 |
|---|------|---------|
| 3-1 | `src/frontend/contexts/auth-context.tsx` を Better Auth クライアントに書き換え | ログイン/ログアウト動作 |
| 3-2 | `login/page.tsx` のフォーム送信先を変更 | ブラウザでログイン成功 |
| 3-3 | `(authenticated)/layout.tsx` のセッションチェック修正 | 未認証時にリダイレクト |

### Phase 4: セキュリティ強化 (Better Auth プラグイン)

| # | 作業 | 確認方法 |
|---|------|---------|
| 4-1 | レート制限プラグイン追加 | 11回連続失敗でブロックされる |
| 4-2 | セッション切れメッセージ (`/login?reason=expired`) | 期限切れ後にメッセージ表示 |
| 4-3 | ログイン監査ログ (Better Auth フック → audit_logs テーブル) | DB にログ記録される |

### Phase 5: 本番統合

| # | 作業 | 担当 |
|---|------|------|
| 5-1 | `.env` に `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` 追加 | インフラ |
| 5-2 | `prisma migrate deploy` (本番 DB にテーブル追加) | インフラ |
| 5-3 | データ移行スクリプト実行 (user_accounts → ba_user + ba_account) | インフラ |
| 5-4 | アプリケーションデプロイ | CI/CD |
| 5-5 | 動作確認: ログイン → ダッシュボード → ログアウト | QA |
| 5-6 | 旧 Cookie (`ios_session`) は自然消滅を待つ (maxAge 経過で消える) | 不要 |

---

## 6. リスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| Better Auth のマイナーバージョン破壊的変更 | ビルド失敗 | `package.json` でバージョン固定 (`"better-auth": "1.x.x"`) |
| データ移行スクリプトの不具合 | ログイン不可 | 移行前に本番 DB のスナップショット取得。ロールバック手順を事前テスト |
| 既存 API Route との互換性崩壊 | 全画面で認証エラー | `getSessionUser()` の返り値を型テストで保証 |
| 全ユーザーの強制ログアウト | 一時的な UX 低下 | デプロイ告知を事前に Slack で通知 |

---

## 7. 環境変数の差分

```diff
# 削除
- SESSION_SECRET="..."
- SESSION_SECURE="false"

# 追加
+ BETTER_AUTH_SECRET="<openssl rand -base64 32>"
+ BETTER_AUTH_URL="http://localhost:3001"          # 本番では https://app.example.com
```

---

## 8. 判断が必要な事項

| # | 質問 | 選択肢 | 推奨 |
|---|------|--------|------|
| 1 | `user_accounts` テーブルは残すか？ | A: 残す (role/member_id の参照元) / B: ba_user に統合 | **A: 残す** — リレーション変更が膨大になるため |
| 2 | Phase 0 (TTL修正) は Better Auth 移行を待たずに先行するか？ | A: 先行 / B: 移行と同時 | **A: 先行** — 1行の変更で即効果 |
| 3 | 2FA はこのフェーズで入れるか？ | A: 入れる / B: 後回し | **B: 後回し** — 移行の複雑さを抑える |
