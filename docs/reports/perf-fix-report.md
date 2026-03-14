# パフォーマンス改善レポート

対象コミット: `4aade11` → `1653b00`（5コミット、19ファイル変更）

---

## 問題の概要

ダッシュボード（`/dashboard`）を開くと **121リクエスト（RSC 41件 + API 80件）** が発生し、
Supabase の同時接続上限を超過して **503エラー** が頻発していた。
加えて **React ハイドレーションエラーが9件** コンソールに出力されていた。

---

## 根本原因

### 1. Next.js `<Link>` の RSC プリフェッチ連鎖（最大のボトルネック）

| 原因 | 影響 |
|------|------|
| Next.js の `<Link>` はビューポート内に入った時点で遷移先の RSC レスポンスを自動プリフェッチする | ダッシュボードに 13個のリンク、サイドバーに 7個のリンク → 合計 **20ページ分の RSC レスポンス** が一斉にフェッチされた |
| 各ページの RSC レスポンス生成時にサーバー側でも認証 API・DB クエリが走る | 1ページ表示で **Supabase への同時接続数が 40〜80** に膨れ上がった |
| `prefetch={false}` を設定しても RSC レスポンス取得は完全には止まらない | AppLink ラッパーを作成して `prefetch={false}` を強制しても効果が不十分だった |

### 2. `new Date()` による SSR/CSR 不一致（ハイドレーションエラー）

| 原因 | 影響 |
|------|------|
| `useState(new Date())` や `useMemo` 内の `new Date()` がサーバーとクライアントで異なる値を返す | タイムゾーン差・ミリ秒差で React が DOM 不一致を検出し、ハイドレーションエラーが発生 |
| 12ファイルで `new Date()` を直接レンダリングパスで使用していた | コンソールに計9件のエラー、ページの初期描画で一瞬ちらつきが発生 |

### 3. /projects ページの不要な NextLink バンドル

| 原因 | 影響 |
|------|------|
| プロジェクトカード内の全リンク（詳細・メンバー）が `<Link>` を使用 | NextLink の JS バンドル + 各リンクの RSC プリフェッチが発生 |
| カード全体が1つのコンポーネントで描画 | フィルタ切替時に全カードが不要に再描画 |

---

## 実施した対策

### 対策 A: `<Link>` → `<a>` タグへの置換

**対象**: ダッシュボード（13リンク）、サイドバー（7リンク）、ヘッダー（戻るリンク）、プロジェクト一覧

```
変更前: <Link href="/attendance">打刻</Link>    ← RSC プリフェッチが自動発生
変更後: <a href="/attendance">打刻</a>           ← 通常の HTML リンク、クリック時のみ遷移
```

- `prefetch={false}` では不十分だったため、根本的に `<Link>` を排除
- ページ遷移は Full Page Load になるが、各ページの表示は 150〜240ms で体感差なし
- **効果: ダッシュボード表示時の RSC リクエストが 41件 → 0件**

### 対策 B: `new Date()` のハイドレーション安全化（12ファイル）

```tsx
// 変更前（SSR/CSR で値が異なる）
const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));

// 変更後（クライアントのみで初期化）
const [month, setMonth] = useState("");
useEffect(() => {
  setMonth(format(new Date(), "yyyy-MM"));
}, []);
```

対象ファイル:
- attendance/list, calendar, closing, workload, schedule
- projects/[id], projects/[id]/assign
- pl/summary, pl/project
- skills/evaluation/[memberId]

SWR キーにも `month ?` ガードを追加し、空文字での無駄なフェッチを防止。

### 対策 C: `suppressHydrationWarning` の付与

ブラウザ拡張（Grammarly, Dark Reader 等）が `<html>`/`<body>` の属性を変更することによるエラーを抑制。

```tsx
<html lang="ja" suppressHydrationWarning>
<body className="antialiased" suppressHydrationWarning>
```

認証状態に依存する表示要素にも付与:
- ヘッダーのユーザー名表示
- サイドバーのナビゲーション

### 対策 D: /projects ページの最適化

| 変更 | 効果 |
|------|------|
| `<Link>` → `<a>` タグ | RSC プリフェッチ排除 |
| `ProjectCard` を `React.memo` で分離 | フィルタ切替時の不要な全カード再描画を防止 |
| Server Component から Prisma クエリを除去 | RSC プリフェッチ時の DB 負荷を排除 |

---

## 改善結果

| 指標 | 改善前 | 改善後 |
|------|--------|--------|
| ダッシュボード表示時のリクエスト数 | 121件 (RSC 41 + API 80) | API のみ（認証1件） |
| 503 エラー | 頻発 | 解消 |
| ハイドレーションエラー | 9件 | 0件（想定） |
| /projects 表示時間 | 1,357ms | 〜400ms（API 271ms + 描画） |

---

## 変更ファイル一覧（19ファイル）

| ファイル | 対策 | 変更内容 |
|----------|------|----------|
| `app-link.tsx` | A | `prefetch={false}` 強制ラッパー作成 |
| `dashboard/page.tsx` | A | Link → `<a>` タグ |
| `sidebar.tsx` | A,C | Link → `<a>` タグ + suppressHydrationWarning |
| `header.tsx` | A,C | Link → `<a>` タグ + suppressHydrationWarning |
| `layout.tsx` (root) | C | html/body に suppressHydrationWarning |
| `projects/page.tsx` | D | Prisma クエリ除去（軽量 Server Component 化） |
| `projects-client.tsx` | D | Link → `<a>` + React.memo ProjectCard |
| `members/page.tsx` | D | Prisma クエリ除去 |
| `members-client.tsx` | D | initialMembers prop 除去 |
| `attendance/list/page.tsx` | B | Date 初期化を useEffect 化 |
| `calendar/page.tsx` | B | Date 初期化を useEffect 化 + プリレンダークラッシュ修正 |
| `closing/page.tsx` | B | Date 初期化を useEffect 化 |
| `workload/page.tsx` | B | Date 初期化を useEffect 化 |
| `schedule/page.tsx` | B | Date 初期化を useEffect 化 |
| `projects/[id]/page.tsx` | B | Date 初期化を useEffect 化 |
| `projects/[id]/assign/page.tsx` | B | Date 初期化を useEffect 化 |
| `pl/summary/page.tsx` | B | Date 初期化を useEffect 化 |
| `pl/project/page.tsx` | B | Date 初期化を useEffect 化 |
| `skills/evaluation/page.tsx` | B | Date 初期化を useEffect 化 |

---

## 教訓

1. **Next.js `<Link>` は「表示しただけ」でプリフェッチが走る** — リンクが多い一覧・ダッシュボードでは `<a>` タグの方が安全
2. **`prefetch={false}` は RSC プリフェッチを完全には止めない** — Next.js App Router では RSC レスポンスの取得が Link の内部動作に組み込まれている
3. **`new Date()` は SSR 互換ではない** — クライアント専用の値は必ず `useEffect` 内で初期化する
4. **Supabase の同時接続上限は意外と低い** — 不要なプリフェッチが DB 接続を消費して本来のリクエストが 503 になる
