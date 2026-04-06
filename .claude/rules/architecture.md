# Architecture Principles（設計・実装の原則）

## 1. フレームワーク API は薄いラッパーで隔離する

- Next.js 固有の API（`cookies()`, `headers()` 等）を直接呼ぶ箇所は最小限にし、専用のラッパー関数に集約する
- API route やページコンポーネントからはラッパー経由でアクセスする
- 理由: フレームワークのバージョンアップ時に修正箇所を1箇所に限定できる
- 例: `cookies()` → `getSession()` に集約（src/backend/auth.ts）

## 2. 暗黙のデフォルトに依存しない

- `fetch()` の `cache` オプション、`dynamic` エクスポートなど、フレームワークがデフォルト値を持つ設定は必ず明示的に指定する
- 理由: メジャーバージョンアップでデフォルトが変更されるケースが多い
- 例: `fetch(url, { cache: "no-store" })`, `export const dynamic = "force-dynamic"`

## 3. 依存の方向を守る（内側に向ける）

- API route（変わりやすい層）→ backend ラッパー（安定層）→ フレームワーク API の順に依存させる
- API route やページから外部ライブラリ・フレームワーク API を直接呼ばない
- 新しい外部依存を追加する場合は、src/backend/ または src/shared/ にラッパーを作ってから利用する

## 4. Request オブジェクト経由を優先する

- API route 内では Next.js のグローバル関数（`headers()`, `cookies()`）より、引数の `req` オブジェクト経由（`req.headers`, `req.nextUrl.searchParams`）を優先する
- 理由: Request オブジェクトの API は Web 標準であり、フレームワーク固有の破壊的変更を受けにくい
