# Architecture Principles

このプロジェクトの設計・実装で守るべき原則。
目的: **フレームワークのバージョンアップに強く、一貫性のあるコードベースを維持する。**

---

## 1. フレームワーク API をラッパーで隔離する

> フレームワーク固有の API を直接呼ぶ箇所を最小化し、変更の影響範囲を1箇所に閉じ込める。

**ルール:**
- `cookies()`, `headers()` 等の Next.js API は専用のラッパー関数に集約する
- API route やページからはラッパー経由でアクセスする

**良い例:**
```
auth.ts:     getSession() → cookies()   ← ここだけ修正すれば全体に反映
route-a.ts:  getSession()
route-b.ts:  getSession()
```

**悪い例:**
```
route-a.ts:  cookies().get("token")   ← 全ファイル修正が必要
route-b.ts:  cookies().get("token")
route-c.ts:  cookies().get("token")
```

---

## 2. 暗黙のデフォルトに依存しない

> フレームワークがデフォルト値を持つ設定は、必ず明示的に指定する。

**ルール:**
- `fetch()` の `cache` オプション、route の `dynamic` エクスポートなどは省略せず書く

**良い例:**
```typescript
fetch(url, { cache: "no-store" });          // 意図を明示
export const dynamic = "force-dynamic";      // 動的レンダリングを明示
```

**悪い例:**
```typescript
fetch(url);  // Next.js 14 では force-cache、15 では no-store — バージョンで挙動が変わる
```

---

## 3. 依存の方向を内側に向ける

> 変わりやすいもの（フレームワーク API）への直接依存を減らし、安定した中間層を経由させる。

**ルール:**
- API route / ページ → `src/backend/` or `src/shared/` → フレームワーク API の順に依存させる
- 新しい外部依存を追加する場合は、ラッパーを作ってから利用する

**依存の方向:**
```
API route（変わりやすい）
    ↓
src/backend/ ラッパー（安定）
    ↓
フレームワーク API / 外部ライブラリ（制御不能）
```

---

## 4. Web 標準 API を優先する

> フレームワーク固有のグローバル関数より、Web 標準の Request オブジェクト経由を選ぶ。

**ルール:**
- API route 内では `req.headers`, `req.nextUrl.searchParams` を使う
- `headers()`, `cookies()` のグローバル関数は避ける（ルール1のラッパー内でのみ許容）

**理由:** Web 標準 API はフレームワークのバージョンアップで壊れない。

---

## 5. 同一パターンはプロジェクト全体で統一する

> 同じ目的のコードに複数の書き方を混在させない。

**ルール:**
- 新しいパターンを導入する場合は、既存の同種コードも全て同時に更新する
- 新規ファイル作成時は、既存ファイルのパターンを確認してから書く

**実例（Next.js 15 移行で発生した問題）:**
```typescript
// API route A — 新しい形式（Promise）
type Params = { params: Promise<{ id: string }> };

// API route B — 古い形式（同期）← これが残っていてビルドエラー
{ params }: { params: { id: string } }
```

混在していたため grep で一括検出できず、修正漏れが3ファイル発生した。

---

## 6. 外部ライブラリのコア機能のみに依存する

> ライブラリの「おまけ機能」はメジャーアップデートで真っ先に削除される。

**ルール:**
- ブランドアイコン（Slack, GitHub 等の企業ロゴ）より汎用アイコンを優先する
- ブランド固有リソースを使う場合は、コメントでその旨を明記する

**実例（lucide-react 1.x で発生した問題）:**
```typescript
// lucide-react 0.x → 1.x でブランドアイコンが一括削除された
import { Slack } from "lucide-react";  // ビルドエラー
```

**判断基準:** そのエクスポートはライブラリの README の冒頭に載っているか？
載っていないなら「おまけ」であり、削除リスクが高い。
