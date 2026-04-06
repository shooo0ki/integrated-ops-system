# SALT2 Operations Management System

Boost / SALT2 の統合業務管理システム。

## Prerequisites

- Node.js 20+
- Docker

## Setup

```bash
# 1. 依存パッケージのインストール（prisma generate も自動実行）
npm install

# 2. 環境変数の設定
cp .env.example .env.local
```

`.env.local` の最低限の設定:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/integrated_ops_dev?schema=public"
DIRECT_URL="postgresql://postgres:password@localhost:5432/integrated_ops_dev?schema=public"
SESSION_SECRET="<openssl rand -base64 32 で生成>"
NEXT_PUBLIC_APP_URL="http://localhost:3001"
```

```bash
# 3. DB 起動 → マイグレーション → シードデータ投入
docker compose up -d
npx prisma migrate dev
npm run db:seed

# 4. 開発サーバー起動
npm run dev
```

http://localhost:3001 で起動。

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | 開発サーバー (port 3001) |
| `npm run build` | ビルド |
| `npm run lint` | ESLint |
| `npm run db:seed` | シードデータ投入 |
| `npx prisma migrate dev` | マイグレーション |
| `npx prisma studio` | DB GUI |

## Tech Stack

Next.js 16 / React 19 / TypeScript 5 / Tailwind CSS 3.4 / PostgreSQL 16 / Prisma 5

## Docs

設計成果物は `docs/requirements/` 配下。実装時は必ず参照すること。
