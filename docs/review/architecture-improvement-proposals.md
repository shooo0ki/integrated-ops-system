# アーキテクチャ改善案

## 現状サマリー

| 指標 | 現状 |
|------|------|
| ページファイル数 | 25 |
| 最大ファイル行数 | 1,453行（closing/page.tsx） |
| 500行超ファイル | 8ファイル |
| 共有コンポーネント | 14ファイル（ui/6, layout/2, members/4, charts/2） |
| カスタムフック | 0 |
| 型定義ファイル | 0（全てインライン） |
| 定数ファイル | 0（全てインライン） |

---

## 1. ディレクトリの分割

### 1-1. ルートグループの分離

**現状:**
```
src/app/
  (main)/          ← 認証済み全ページ
  login/page.tsx   ← ログイン
  page.tsx         ← ルート（リダイレクト）
```

**改善案:**
```
src/app/
  (authenticated)/    ← 旧 (main)。ログイン済みユーザーだけがアクセスできるページ
    layout.tsx        ← sidebar + header のレイアウト
    dashboard/
    closing/
    ...
  (unauthenticated)/  ← ログインしていない人向けのページ
    login/page.tsx
    forgot-password/page.tsx   ← 将来拡張
    layout.tsx                 ← ロゴだけのシンプルなレイアウト
  page.tsx            ← ルートリダイレクト（現状維持）
```

**なぜ必要か:**

Next.js の「ルートグループ」は `()` で囲んだフォルダ名で、URL には影響しないが **同じレイアウトを共有するページをまとめる** 機能です。

現状の `(main)` という名前だと、初めてコードを見た人は「何が "main" なの？」と疑問に思います。`(authenticated)` / `(unauthenticated)` にするだけで、**フォルダ名が「このグループのページにアクセスできるのは誰か」を説明してくれる** ようになります。

たとえるなら、「書類ファイル A」「書類ファイル B」というラベルより、「社外秘書類」「公開書類」というラベルの方が、どの書類を入れるべきか迷わないのと同じです。

**影響範囲:** フォルダ名を変えるだけ。URL やインポートパスには影響しません。

---

### 1-2. コンポーネントの分類（common / domain）

**現状:**
```
src/components/
  ui/        ← Button, Card, Modal（どこでも使える汎用部品）
  layout/    ← Header, Sidebar
  members/   ← メンバー詳細ページ専用の部品
  charts/    ← グラフ
```

**改善案:**
```
src/components/
  common/                 ← どのページでも使える「汎用部品」
    button.tsx
    card.tsx
    modal.tsx
    input.tsx
    badge.tsx
    loading-spinner.tsx   ← 新規
    empty-state.tsx       ← 新規
  layout/                 ← 現状維持
  domain/                 ← 特定の業務にしか使わない「専用部品」
    closing/
      admin-closing-view.tsx
      member-billing-view.tsx
      closing-table-row.tsx
      self-report-card.tsx
    calendar/
      week-view.tsx
      month-view.tsx
    contracts/
      status-flow.tsx
      contract-create-modal.tsx
    evaluation/
      edit-modal.tsx
      star-bar.tsx
    members/              ← 現 components/members をここに移動
    mypage/
      profile-edit-modal.tsx
      today-attendance-card.tsx
  charts/                  ← 現状維持
```

**なぜ必要か:**

コンポーネントには2種類あります：

- **汎用部品**（common）: Button や Card のように、アプリのどこでも使える「レゴブロック」
- **専用部品**（domain）: 締め管理のテーブル行や、カレンダーの週表示のように、**特定の業務でしか意味を持たない部品**

今は `components/ui/` に汎用部品、`components/members/` に専用部品が混在しています。新しくコンポーネントを作るとき、「これは ui/ に入れるの？ members/ のように新しいフォルダを作るの？」と迷います。

`common/` と `domain/` に分けておけば、**「どこでも使えるなら common、特定ページ専用なら domain/そのページ名」** というルールが明確になります。

---

### 1-3. lib/ の責務分割

**現状の lib/ フォルダ:**
```
src/lib/
  auth.ts              ← サーバーで使う（セッション管理）
  auth-context.tsx     ← ブラウザで使う（React の状態管理）
  db.ts                ← サーバーで使う（DB接続）
  utils.ts             ← どこでも使う（日付フォーマット等）
  slack.ts             ← サーバーで使う（Slack API）
  email.ts             ← サーバーで使う（メール送信）
  docusign.ts          ← サーバーで使う（電子契約）
  swr-config.tsx       ← ブラウザで使う（データ取得設定）
```

**改善案:**
```
src/lib/           ← 純粋なユーティリティだけ残す
  auth.ts
  db.ts
  utils.ts

src/contexts/      ← ブラウザ専用：React の Context / Provider
  auth-context.tsx
  swr-config.tsx

src/services/      ← サーバー専用：外部サービスとの通信
  slack.ts
  email.ts
  docusign.ts
  invoice-excel.ts
```

**なぜ必要か:**

`lib/` に全部入れると、**サーバーでしか動かないコードと、ブラウザでしか動かないコードが同じ場所にある** 状態になります。

たとえば `lib/slack.ts` はサーバーサイドでしか使えません（Slack の Bot Token を直接使うため）。でもフォルダ名からはそれが分かりません。もし初心者がブラウザ側のコンポーネントで `import { sendSlack } from "@/lib/slack"` と書いてしまうと、ビルドエラーになります。

`services/` フォルダに分けておけば、**「services/ の中身はサーバー専用だから、ブラウザ側（"use client" のファイル）からは import しない」** というルールが構造的に伝わります。

同様に、`auth-context.tsx`（React Context）と `auth.ts`（iron-session 設定）は名前が似ていますが、使う場所が全く違います。`contexts/` に分けることで **「contexts/ は React コンポーネントから使うもの」** と明確になります。

---

## 2. コードレベル

### 2-1. 巨大ページファイルの分割

**対象ファイルと、中に埋まっているコンポーネント:**

#### closing/page.tsx（1,453行）— 最も深刻

| 行 | 中身 | 役割 |
|----|------|------|
| 17〜58 | 型定義 6個 | `ClosingRecord`, `Invoice`, `InvoiceItem` 等 |
| 60〜80 | 定数・ヘルパー 4個 | `confirmVariant`, `confirmLabel`, `receiptConfig`, `formatCurrency`（lib/utils.ts と重複） |
| 82〜90 | `buildMonthOptions()` | `lib/utils.ts` の `buildMonths()` と処理が重複 |
| 94〜669 | `AdminClosingView` | useState **10個**、useSWR **4個**、useCallback **4個**、useMemo **2個** を内包する巨大コンポーネント |
| 632〜666 | 型定義 5個 | `LineItem`, `ExpenseItem`, `MyProject`, `SelfReportRow`, `SelfReportItem` |
| 671〜943 | `SelfReportCard` | useState **4個**、useSWR **2個** を持つ独立したカード。別ファイルに分けられる |
| 945〜1439 | `MemberBillingView` | useState **11個**、useSWR **3個** を持つメンバー向けビュー。約500行 |
| 1022〜1054 | `addItem`, `removeItem`, `updateItem` 等 9個 | 経費・交通費の追加/削除/更新ハンドラ。**3セット（items/expenses/transports）で同じパターンが繰り返し** |
| 1441〜1453 | `ClosingPage` | role で AdminClosingView / MemberBillingView を出し分けるだけ |

#### contracts/page.tsx（723行）

| 行 | 中身 | 役割 |
|----|------|------|
| 16〜40 | 型定義 3個 | `ContractStatus`, `ContractRecord`, `DocuSignTemplate` |
| 47〜66 | 定数 3個 | `STATUS_ORDER`, `statusConfig`, `FLOW_STEPS` |
| 74〜101 | `StatusFlow` コンポーネント | 契約ステータスの可視化。完全に独立しており別ファイルにできる |
| 103〜723 | `ContractsPage` | useState **9個**、useSWR **3個**、fetch **5箇所** を持つ巨大コンポーネント |
| 143〜146 | `showToast()` | setTimeout クリーンアップ漏れ（closing/page.tsx では正しく実装されているのに） |
| 173〜225 | `handleCreate()` | 契約作成処理。既存メンバー/新規メンバーで分岐する50行のロジック |
| 355〜480 | 作成モーダルの JSX | コンポーネントとして切り出せる |
| 482〜720 | 詳細モーダルの JSX | コンポーネントとして切り出せる |

#### mypage/page.tsx（697行）

| 行 | 中身 | 役割 |
|----|------|------|
| 24〜92 | 型定義 7個 | `MemberDetail`, `TodayAttendance`, `MyProject`, `EvalRecord`, `ProfileForm` 等 |
| 16〜22 | 定数 2個 | `roleLabel`（settings/page.tsx と重複）, `levelLabels` |
| 95〜195 | `ProfileEditModal` | useState **3個**、fetch **1箇所**。完全に独立したモーダル |
| 197〜296 | `PasswordChangeModal` | useState **4個**、fetch **1箇所**。230行目に setTimeout クリーンアップ漏れ |
| 298〜311 | `ScoreDot` | 小さなヘルパーコンポーネント |
| 313〜341 | `TodayAttendanceCard` | `React.memo` 済み、独自の useSWR あり。**既に独立している良い例** |
| 344〜697 | `MyPage` | 本体。プロフィール表示 + スキル一覧 + プロジェクト一覧 + 評価カード等 |

#### calendar/page.tsx（690行）

| 行 | 中身 | 役割 |
|----|------|------|
| 10〜16 | 定数 7個 | `HOUR_PX`, `START_HOUR`, `END_HOUR`, `GRID_H`, `TIME_W`, `DAY_MIN_W`, `HOURS` |
| 21 | `let TODAY = ""` | **グローバル可変変数。React のルール違反**（13-4 参照） |
| 22〜40 | 定数 3個 | `DOW_JP`, `COLORS`（8色分）, `LOCATION_CONFIG` |
| 44〜49 | 型定義 6個 | `CalMember`, `CalProject`, `SchedEntry`, `AttEntry`, `CalData`, `ViewMode` |
| 53〜125 | ユーティリティ関数 8個 | `dateStr`, `normalizeHour`, `timeToY`, `spanPx`, `nowTimeStr`, `nowY`, `buildWeekDays`, `buildMonthGrid` |
| 127〜137 | `LocationBadge` | 小さなヘルパーコンポーネント |
| 139〜320 | `WeekView`（180行） | useMemo **3個**、useState **1個** |
| 324〜435 | `MonthView`（110行） | useMemo **4個**、useCallback **1個** |
| 437〜690 | `CalendarPage` | useState **6個**、useSWR **1個**、useMemo **5個** |

#### その他の500行超ファイル

| ファイル | 行数 | 主な中身 |
|---------|------|---------|
| pl/summary/page.tsx | 662 | 型定義 `PLRecord`（24〜40行）、`formatCurrency`（46行, lib/utils.ts と重複）、管理者/マネージャーで表示切替 |
| projects/[id]/page.tsx | 604 | 型定義 5個（17〜66行）、定数 3個（70〜78行）、`formatCurrency`（84行, 重複）、fetch **5箇所** エラーハンドリングなし |
| members/[id]/page.tsx | 562 | 型定義 4個（18〜63行）、定数 6個（67〜87行）、fetch **5箇所** エラーハンドリングなし |
| pl/project/page.tsx | 495 | 型定義 2個（18〜43行）、`formatCurrency`（47行, 重複）、`Toast` コンポーネント（64行） |
| evaluation/page.tsx | 420 | `StarBar`（39行）, `ScoreBadge`（49行）, `EditModal`（69行）— 3つのヘルパーコンポーネントが埋まっている |
| attendance/page.tsx | 437 | useState **13個**、楽観的更新3箇所にロールバックなし（13-1 参照） |
| attendance/list/page.tsx | 468 | useState **9個**（うち form 系3個）、fetch **4箇所** エラーハンドリングなし |

**分割方針:**

例として closing/page.tsx を分割するとこうなります：

```
src/app/(main)/closing/
  page.tsx                  ← 入り口だけ（~15行）
  _components/              ← このページ専用の部品置き場
    admin-closing-view.tsx  ← 94〜669行目を移動
    member-billing-view.tsx ← 945〜1439行目を移動
    self-report-card.tsx    ← 671〜943行目を移動
    invoice-detail-modal.tsx
```

**分割後の page.tsx（たった15行）:**
```tsx
"use client";
import { useAuth } from "@/lib/auth-context";
import { AdminClosingView } from "./_components/admin-closing-view";
import { MemberBillingView } from "./_components/member-billing-view";

export default function ClosingPage() {
  const { role, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner />;
  return role === "admin" ? <AdminClosingView /> : <MemberBillingView />;
}
```

**なぜ必要か:**

1つのファイルに 1,453行あると、以下の問題が起きます：

- **読めない**: 「Slack通知ボタンのコードはどこ？」→ 1,453行をスクロールして探す必要がある
- **壊しやすい**: 1箇所の修正で他の部分を誤って壊すリスクがある。差分が大きいとレビューも困難
- **再利用できない**: `SelfReportCard`（671〜943行目）は他のページでも使えるかもしれないが、closing/page.tsx の中に埋まっているため取り出せない

本に例えると、**1,453ページの本に目次も章分けもない状態** です。章ごとに分ければ、読みたい部分だけ開けます。

Next.js では `_components/` というフォルダ名（先頭に `_`）を使うと、その中のファイルはページとして認識されません。ページと同じ場所に「このページ専用の部品」を安全に置けます。

---

### 2-2. ローディング/空状態の統一

**現状の問題:**

14個のページファイルに、こんなコードがコピペされています：

```tsx
// これが14ファイルに散在
if (loading) return <div className="py-8 text-center text-sm text-slate-400">読み込み中...</div>;
```

また、データが0件のときの表示も5ファイルで同じようなコードが繰り返されています。

**改善案:**

```tsx
// 1回だけ作る
// src/components/common/loading-spinner.tsx
export function LoadingSpinner({ message = "読み込み中..." }) {
  return (
    <div className="py-8 text-center text-sm text-slate-400">{message}</div>
  );
}

// 全ページで使い回す
if (loading) return <LoadingSpinner />;
```

**なぜ必要か:**

同じコードを複数箇所にコピペすると、**変更が必要なとき全箇所を手作業で直す必要があります**。たとえば「読み込み中のアニメーションを追加したい」と思ったら、14ファイル全部を修正しなければなりません。

1つの共通コンポーネントにしておけば、**1箇所の変更で全ページに反映** されます。これがプログラミングで「DRY（Don't Repeat Yourself：同じことを繰り返すな）」と呼ばれる原則です。

---

### 2-3. 関数の重複排除

**発見した重複:**

| 関数/定数 | 定義箇所（行番号） | 対策 |
|-----------|-------------------|------|
| `formatCurrency()` | `lib/utils.ts:8`, `closing/page.tsx:78`, `pl/summary/page.tsx:46`, `pl/project/page.tsx:47`, `projects/[id]/page.tsx:84` | lib/utils.ts に統一し、他は import に変更 |
| `buildMonthOptions()` | `closing/page.tsx:82`（AdminClosingView 用）, `closing/page.tsx:961`（MemberBillingView 用で同一関数を再呼び出し） | `lib/utils.ts:19` の `buildMonths()` と処理が同じ。統合 |
| `roleLabel` | `mypage/page.tsx:16`, `members/[id]/page.tsx:72` | `constants/labels.ts` に移動 |
| `statusVariant` / `STATUS_LABELS` | `attendance/page.tsx:42-47`, `attendance/list/page.tsx:35-40` | 同じ内容が2ファイルに。`constants/attendance.ts` に移動 |
| `formatDate()` | `lib/utils.ts:12`, `projects/[id]/page.tsx:80` | projects 側を削除して import |
| `MONTHS = buildMonths(...)` | `evaluation/page.tsx:37`, `pl/summary/page.tsx:60`, `pl/project/page.tsx:62`, `pl/cashflow/page.tsx:34` | 4ファイルで同じ呼び出し。引数だけ違う（6 or 12） |

**なぜ必要か:**

`formatCurrency()` が **5箇所** にあると、「通貨表示のフォーマットを変えたい」ときに **4箇所直し忘れる** という事故が起きます。実際、closing/page.tsx:78 の `formatCurrency` と lib/utils.ts:8 のものは全く同じ処理です。1箇所にまとめれば、こうしたミスが構造的に起きなくなります。

---

## 3. 層の分割（ロジック / プレゼンテーション）

### 3-1. カスタムフックの導入

**現状の問題:**

ページコンポーネントの中に **「データの取得」「ボタンを押したときの処理」「画面の表示」** が全部混ざっています。

closing/page.tsx を例にすると：
```tsx
function AdminClosingView() {
  // --- データ取得（50行）---
  const { data: records } = useSWR(...);
  const { data: invoices } = useSWR(...);

  // --- ボタン押したときの処理（150行）---
  async function handleSendSlack(memberId) { ... }
  async function handleSendAll() { ... }
  async function handleForce(memberId) { ... }
  async function doAggregate() { ... }

  // --- 画面の表示（1,200行）---
  return (
    <div>
      <テーブル />
      <モーダル />
      <カード />
    </div>
  );
}
```

**改善案:**

「データ取得 + ボタン処理」を **カスタムフック** に分離する。

```
src/hooks/
  use-closing.ts          ← 締め管理のデータ取得と操作
  use-self-report.ts      ← 月次申告のデータ取得と送信
  use-calendar.ts         ← カレンダーのデータ取得
  use-attendance.ts       ← 勤怠の打刻・一覧取得
  use-contracts.ts        ← 契約の作成・更新・削除
  use-evaluation.ts       ← 人事評価の取得・更新
  use-month-navigation.ts ← 月の前後移動（複数ページで共通）
  use-toast.ts            ← 「保存しました」等の通知表示（複数ページで共通）
```

**フック化のイメージ:**
```tsx
// src/hooks/use-closing.ts（ロジックだけ集めたファイル）
export function useAdminClosing(targetMonth: string) {
  const { data: records } = useSWR<ClosingRecord[]>(...);
  const { data: invoices } = useSWR<Invoice[]>(...);

  const handleSendSlack = useCallback(async (memberId: string) => {
    // Slack 通知送信の処理
  }, [...]);

  return { records, invoices, handleSendSlack, loading };
}

// 使う側（AdminClosingView）
function AdminClosingView() {
  const { records, invoices, handleSendSlack, loading } = useAdminClosing(month);
  // ↑ ロジックが1行で済む。あとは画面の見た目だけに集中できる
  return <テーブル records={records} onSendSlack={handleSendSlack} />;
}
```

**なぜ必要か:**

料理に例えると、今は **「材料の仕入れ」「調理」「盛り付け」を全部キッチンの1枚の紙に書いている** 状態です。

フックに分離すると：
- **仕入れ・調理 = フック**（データをどう取得して、どう加工するか）
- **盛り付け = コンポーネント**（画面にどう表示するか）

この分離により：
1. **コンポーネントが短くなる**: 画面の見た目に集中できるため、読みやすくなる
2. **ロジックの再利用**: `use-month-navigation.ts` は closing にも cashflow にも evaluation にも使える
3. **テストしやすい**: ロジックだけを画面なしでテストできる

---

### 3-2. API呼び出し関数の抽出

**現状の問題:**

各コンポーネントで `fetch("/api/...")` を直接書いています：

```tsx
// closing/page.tsx の中
const res = await fetch(`/api/closing/members/${memberId}/notify`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ month }),
});

// contracts/page.tsx の中にも似たような fetch がたくさん
const res = await fetch("/api/contracts", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ... }),
});
```

**改善案:**

API 呼び出しを専用のファイルにまとめる：

```
src/lib/api/
  closing.ts        ← 締め管理の API 呼び出し
  invoices.ts       ← 請求書の API 呼び出し
  members.ts        ← メンバーの API 呼び出し
  contracts.ts      ← 契約の API 呼び出し
```

```tsx
// src/lib/api/closing.ts
export async function sendSlackNotify(memberId: string, month: string) {
  const res = await fetch(`/api/closing/members/${memberId}/notify`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ month }),
  });
  if (!res.ok) throw new Error("Slack通知の送信に失敗しました");
  return res.json();
}

// 使う側
import { sendSlackNotify } from "@/lib/api/closing";
await sendSlackNotify(memberId, targetMonth);  // 1行で完結
```

**なぜ必要か:**

現状は API の URL（`/api/closing/members/${memberId}/notify`）が **UIコンポーネントの中にハードコードされています**。

これが問題になるケース：
1. **URLを変更したとき**: API のパスを変えたら、使っている全コンポーネントを探して直す必要がある
2. **エラー処理がバラバラ**: あるページでは `if (res.ok)` だけで失敗を無視、別のページではエラーメッセージを表示、と対応が統一されていない
3. **同じ呼び出しの重複**: 同じ API を複数ページから呼ぶとき、fetch のコードがコピペされる

電話に例えると、**電話帳を使わずに全員の電話番号を暗記して直接ダイヤルしている** 状態です。電話帳（api/closing.ts）を作れば、番号が変わっても電話帳を更新するだけで済みます。

---

## 4. 型定義

### 4-1. 型定義の外部化

**現状の問題:**

全てのページファイルの先頭に、そのページで使う型が書かれています：

```tsx
// closing/page.tsx の先頭に ~50行
interface ClosingRecord { memberId: string; memberName: string; ... }
interface Invoice { id: string; memberId: string; ... }

// mypage/page.tsx の先頭にも ~40行
interface MemberDetail { id: string; name: string; ... }
interface MyProject { projectId: string; projectName: string; ... }

// closing/page.tsx にも MyProject がある（同じ型の重複！）
interface MyProject { projectId: string; projectName: string; ... }
```

**改善案:**

```
src/types/
  closing.ts      ← ClosingRecord, Invoice, InvoiceItem
  calendar.ts     ← CalMember, CalProject, SchedEntry
  attendance.ts   ← AttRecord, TodayAttendance
  evaluation.ts   ← EvalRow, OwnEval
  members.ts      ← MemberDetail, MemberOption
  projects.ts     ← Project, MyProject     ← MyProject はここに1回だけ定義
  contracts.ts    ← Contract, ContractStatus
```

**全ページのインライン型定義（移動対象）:**

| ファイル | 行番号 | 型名 |
|---------|--------|------|
| closing/page.tsx | 17〜58 | `ConfirmStatus`, `InvoiceStatus`, `ClosingRecord`, `InvoiceItem`, `Invoice` |
| closing/page.tsx | 632〜666 | `LineItem`, `ExpenseItem`, **`MyProject`**, `SelfReportRow`, `SelfReportItem` |
| mypage/page.tsx | 24〜92 | `MemberDetail`, `TodayAttendance`, **`MyProject`**, `EvalRecord`, `MyPageResponse`, `ProfileForm` |
| calendar/page.tsx | 44〜49 | `CalMember`, `CalProject`, `SchedEntry`, `AttEntry`, `CalData`, `ViewMode` |
| contracts/page.tsx | 16〜40 | `ContractStatus`, `ContractRecord`, `DocuSignTemplate` |
| evaluation/page.tsx | 10〜34 | `EvalRow`, `OwnEval` |
| attendance/page.tsx | 13〜38 | `AttendanceStatus`, `TodayRecord`, `CorrectionRecord` |
| attendance/list/page.tsx | 14〜31 | `AttendanceRecord`, **`MemberOption`** |
| tools/page.tsx | 13〜27 | `ToolEntry`, **`MemberOption`** |
| projects/[id]/page.tsx | 17〜66 | `Position`, `Assignment`, `ProjectDetail`, `EditForm`, **`MemberOption`** |
| members/[id]/page.tsx | 18〜63 | `ToolItem`, `SkillItem`, `ContractItem`, `MemberDetail` |
| pl/summary/page.tsx | 24〜40 | `PLRecord` |
| pl/project/page.tsx | 18〜43 | `PLRecord`, `ProjectTab` |
| pl/cashflow/page.tsx | 21〜32 | `CfRecord` |

**実際に見つかった重複（太字）:**

| 型名 | 定義箇所 |
|------|---------|
| `MyProject` | mypage/page.tsx:57 と closing/page.tsx:648 |
| `MemberOption` | tools/page.tsx:24, contracts/page.tsx:35（`Member`名だが同構造）, attendance/list/page.tsx:28, projects/[id]/page.tsx:62 の **4箇所** |
| `PLRecord` | pl/summary/page.tsx:24 と pl/project/page.tsx:18 の **2箇所** |
| `MemberDetail` | mypage/page.tsx:24 と members/[id]/page.tsx:45（フィールドが微妙に異なるが本来同じ概念） |

**なぜ必要か:**

型（interface / type）は **「このデータの形はこうです」という約束ごと** です。

同じ `MyProject` が2つのファイルに別々に書かれていると：
- **片方だけ変更するとバグになる**: API がフィールドを追加したとき、mypage 側は更新したが closing 側は忘れた → 型エラーにならず、ランタイムで壊れる
- **読む人が混乱する**: 「この MyProject は mypage のと同じ？違う？」と毎回確認が必要

1箇所に集めれば、**型を変更したら全ての使用箇所で TypeScript が自動的にエラーを出してくれる** ので、修正漏れが起きません。

---

### 4-2. API レスポンス型の共有

**現状の問題:**

API route（サーバー側）とページ（ブラウザ側）で、**同じデータ構造の型を別々に定義** しています。

```tsx
// サーバー: src/app/api/closing/route.ts
// → ClosingRecord の形でデータを返すが、型定義はない（暗黙的）

// ブラウザ: src/app/(main)/closing/page.tsx
interface ClosingRecord { ... }  // 「APIはこの形で返すはず」と仮定して手書き
```

**改善案:**

```tsx
// src/types/api/closing.ts（1箇所に定義）
export interface ClosingRecordResponse {
  memberId: string;
  memberName: string;
  // ...
}

// サーバー側で使う
import type { ClosingRecordResponse } from "@/types/api/closing";
return NextResponse.json(records satisfies ClosingRecordResponse[]);
//                                ^^^^^^^^^ 「この型に合っているか」をコンパイル時にチェック

// ブラウザ側で使う
import type { ClosingRecordResponse } from "@/types/api/closing";
const { data } = useSWR<ClosingRecordResponse[]>("/api/closing?...");
```

**なぜ必要か:**

今の状態は、**手紙の差出人と受取人が「封筒の中身」を口頭で打ち合わせている** ようなものです。差出人が中身を変えても、受取人は気づきません。

共通の型を使えば、**サーバーが返すデータの形を変えたとき、ブラウザ側が TypeScript のエラーとしてすぐ気づける** ようになります。「API のレスポンスを変えたのにフロントを直し忘れた」という、見つけにくいバグを防げます。

---

## 5. 定数系

### 5-1. 定数ファイルの作成

**現状の問題:**

定数（変わらない値）がページファイルの中に直接書かれています：

```tsx
// calendar/page.tsx に15行以上の定数
const HOUR_PX    = 64;
const START_HOUR = 7;
const END_HOUR   = 31;
const DOW_JP = ["日", "月", "火", "水", "木", "金", "土"];
const COLORS = [ { bg: "bg-blue-100", ... }, ... ];  // 8色分の定義

// mypage/page.tsx
const roleLabel = { admin: "管理者", manager: "マネージャー", member: "メンバー" };
const levelLabels = ["", "★", "★★", "★★★", "★★★★", "★★★★★"];

// settings/page.tsx にも同じ roleLabel がある！
```

**全ページの定数（移動対象）:**

| ファイル | 行番号 | 定数名 | 移動先 |
|---------|--------|--------|--------|
| calendar/page.tsx | 10〜16 | `HOUR_PX`, `START_HOUR`, `END_HOUR`, `GRID_H`, `TIME_W`, `DAY_MIN_W`, `HOURS` | constants/calendar.ts |
| calendar/page.tsx | 22 | `DOW_JP` | constants/calendar.ts |
| calendar/page.tsx | 24〜33 | `COLORS`（8色 × 4プロパティ = 32行分） | constants/calendar.ts |
| calendar/page.tsx | 37〜40 | `LOCATION_CONFIG` | constants/calendar.ts |
| closing/page.tsx | 62〜76 | `confirmVariant`, `confirmLabel`, `receiptConfig` | constants/closing.ts |
| mypage/page.tsx | 16〜21 | `roleLabel` | constants/labels.ts |
| mypage/page.tsx | 22 | `levelLabels` | constants/evaluation.ts |
| members/[id]/page.tsx | 67〜87 | `statusLabel`, `roleLabel`（重複!）, `salaryTypeLabel`, `contractStatusLabel` | constants/labels.ts |
| evaluation/page.tsx | 36 | `SCORE_LABELS` | constants/evaluation.ts |
| attendance/page.tsx | 42〜47 | `statusVariant`, `STATUS_LABELS` | constants/attendance.ts |
| attendance/list/page.tsx | 35〜40 | `statusVariant`, `STATUS_LABELS`（attendance/page.tsx と重複!） | constants/attendance.ts |
| contracts/page.tsx | 47〜66 | `STATUS_ORDER`, `statusConfig`, `FLOW_STEPS` | constants/contracts.ts |
| projects/[id]/page.tsx | 70〜78 | `STATUS_LABELS`, `STATUS_COLOR`, `CONTRACT_LABELS` | constants/labels.ts |
| settings/page.tsx | 13〜19 | `DEFAULT_FORM` | constants/settings.ts |

**改善案:**

```
src/constants/
  labels.ts        ← roleLabel, statusLabel, salaryTypeLabel 等（5ファイルに散在する表示名ラベルを統合）
  calendar.ts      ← HOUR_PX, COLORS, DOW_JP 等（calendar/page.tsx から30行以上が移動）
  evaluation.ts    ← SCORE_LABELS, levelLabels
  closing.ts       ← confirmLabel, receiptConfig
  attendance.ts    ← statusVariant, STATUS_LABELS（2ファイルの重複を解消）
  contracts.ts     ← STATUS_ORDER, statusConfig, FLOW_STEPS
```

**なぜ必要か:**

定数は **「この値を変えると、アプリの動きや見た目が変わる」設定値** です。

たとえば `roleLabel`（ロールの表示名）は `mypage/page.tsx:16` と `members/[id]/page.tsx:72` の2箇所に書かれています。もし「マネージャー」を「MG」に変えたいとき、**片方だけ変えると、ページによって表示が違う** という不具合が起きます。

`statusVariant` と `STATUS_LABELS` も `attendance/page.tsx:42-47` と `attendance/list/page.tsx:35-40` で全く同じ内容が重複しています。

また、calendar/page.tsx では定数だけで **30行以上** あります（10〜40行目）。ページの「見た目を書くコード」の前に設定値がずらっと並んでいると、**本題のコードにたどり着くまでにスクロールが必要** です。

定数を別ファイルにまとめると：
- **1箇所の変更で全ページに反映** される（DRY原則）
- **ページファイルが短くなり**、「このファイルは何をしているか」がすぐ分かる
- **「設定値を変えたい」** と思ったとき、`constants/` フォルダを見れば全部見つかる

---

## 6. パフォーマンス（再レンダリング）

### 6-1. 現状の問題

**そもそも「再レンダリング」とは？**

React は、コンポーネントの **state（状態）が変わると、そのコンポーネントを丸ごと「描き直し」** ます。これを「再レンダリング」と呼びます。

小さなコンポーネントなら問題ありません。しかし、1,453行のコンポーネントの場合、**たった1つのボタンの状態が変わっただけで、1,453行分の処理が全て走り直します**。

**具体例: closing/page.tsx**

`AdminClosingView`（94行目〜669行目、**575行**）には useState が **10個** 同居しています：

```tsx
// closing/page.tsx 95〜104行目
const [targetMonth, setTargetMonth] = useState("");           // 95行目: 対象月
const [aggregateWarning, setAggregateWarning] = useState(false); // 96行目: 集計警告モーダル
const [aggregating, setAggregating] = useState(false);        // 97行目: 集計中フラグ
const [sendingAll, setSendingAll] = useState(false);          // 98行目: 一斉送信中
const [sendingSlackId, setSendingSlackId] = useState(null);   // 99行目: 個別Slack送信中
const [forcingId, setForcingId] = useState(null);             // 100行目: 強制確定中
const [accountingId, setAccountingId] = useState(null);       // 101行目: 経理送付中
const [toastMsg, setToastMsg] = useState(null);               // 102行目: トースト通知
const [detailInvoice, setDetailInvoice] = useState(null);     // 103行目: 請求書モーダル
const [monthOptions, setMonthOptions] = useState([]);         // 104行目: 月選択肢
```

ここで「Aさんに Slack 通知を送信」ボタン（408行目付近）を押すと：

1. 99行目の `setSendingSlackId("Aさんの ID")` が呼ばれる
2. React は `AdminClosingView` **全体（575行）** を再レンダリング
3. KPIカード（227〜300行目）、テーブル全行（300〜500行目）、モーダル（530〜660行目）、全部が描き直される
4. でも実際に変わったのは **Aさんの行のボタンだけ**

これは、**本の1文字を直すために本全体を印刷し直している** ようなものです。

**同じ問題があるページ:**
- calendar/page.tsx: 週表示と月表示が同じ state に依存 → タブを切り替えるだけで全体が再描画
- contracts/page.tsx: 一覧テーブル + 作成モーダル + 詳細モーダルが同居 → モーダルを開くだけでテーブルも再描画
- mypage/page.tsx: プロフィール編集 + パスワード変更 + 勤怠カードが同居
- evaluation/page.tsx: 一覧テーブル + 編集モーダルが同居

### 6-2. 改善方針

**A. コンポーネントを分けて React.memo で囲む**

React.memo は **「props（親から渡されるデータ）が変わっていなければ、再レンダリングをスキップする」** 仕組みです。

```tsx
// テーブルの各行を独立したコンポーネントにする
const ClosingTableRow = memo(function ClosingTableRow({ record, onSendSlack }: Props) {
  // この行に関係ない state が変わっても、この行は描き直されない
});
```

今は全行が1つのコンポーネント内のループで描画されているため、memo の恩恵を受けられません。行を独立コンポーネントに分けることで、**変更があった行だけが再レンダリングされる** ようになります。

**B. モーダルの state を親から分離する**

```tsx
// 現状: 親コンポーネントがモーダルの開閉状態を管理
function AdminClosingView() {
  const [detailInvoice, setDetailInvoice] = useState(null);  // ← これが変わると全体再レンダリング
  return (
    <>
      <テーブル />
      <モーダル invoice={detailInvoice} />  // モーダル
    </>
  );
}

// 改善: モーダル自身が開閉状態を管理
function InvoiceDetailModal({ invoiceId, onClose }) {
  const { data: invoice } = useSWR(invoiceId ? `/api/invoices/${invoiceId}` : null);
  // モーダルの内部状態が変わっても、親（テーブル等）には影響しない
}
```

**C. コンポーネントツリーで state のスコープを限定する**

分割後のイメージ：

```
AdminClosingView (targetMonth のみ管理)
  ├── KPISection        ← records から計算した値を props で受け取る（memo）
  ├── ClosingTable      ← records をループ
  │    └── ClosingTableRow × N（memo）
  │         └── SlackButton ← 送信中かどうかは、この行の中だけで管理
  ├── AggregateWarningModal ← 開閉は自分で管理
  └── InvoiceDetailModal    ← 開閉は自分で管理
```

**期待される改善効果:**

| 操作 | 現状の再レンダリング範囲 | 改善後 |
|------|----------------------|--------|
| Slack 送信ボタンを押す | 1,453行全体 | 該当行の SlackButton だけ |
| 請求書モーダルを開く | 1,453行全体 | モーダルコンポーネントだけ |
| トースト表示 | 1,453行全体 | トーストコンポーネントだけ |
| 月を変更する | 1,453行全体 | テーブル + KPI（これは正常な動作） |

つまり、**「影響範囲を必要最小限にする」** ことがパフォーマンス改善の基本です。

---

## 7. エラーハンドリング

### 7-1. API のエラーレスポンスがバラバラ

**現状の問題:**

API ルートによって、エラーの返し方が統一されていません：

```tsx
// パターンA: 構造化エラー（attendances/route.ts）
return NextResponse.json(
  { error: { code: "BAD_REQUEST", message: "リクエストボディが不正です" } },
  { status: 400 }
);

// パターンB: 単純な文字列（closing/route.ts）
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

// パターンC: 200で空配列を返す（closing/route.ts 152行目）
// エラーなのに成功扱い！
console.error("Closing API error:", error);
return NextResponse.json([]);  // ← 200 OK + 空データ
```

**改善案:**

```tsx
// src/lib/api-response.ts（統一フォーマットを1箇所に定義）
export function apiError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// 使う側
return apiError("UNAUTHORIZED", "ログインが必要です", 401);
return apiError("BAD_REQUEST", "月の形式が不正です", 400);
```

**なぜ必要か:**

フロントエンド（ブラウザ側）でエラーを処理するとき、**エラーの形がバラバラだと、毎回「このAPIはどのパターンで返してくるんだっけ？」を確認する必要があります**。

統一しておけば、フロントエンドで `res.error.message` と書くだけで必ずエラーメッセージが取れるので、処理が簡単になります。

特にパターンCは危険です。**エラーが起きたのに HTTP 200（成功）を返している** ため、フロントエンドは「データが0件なのか、エラーなのか」区別できません。エラーが起きたときは必ず 4xx/5xx を返すべきです。

---

### 7-2. フロントエンドのエラー表示が不足

**現状の問題:**

ほとんどのページで、**APIからエラーが返ってきたときの表示がありません**：

```tsx
// skills/page.tsx など多数のページ
const { data, isLoading } = useSWR("/api/...");

if (isLoading) return <LoadingSpinner />;
// ← data が null（エラー）のケースが考慮されていない
// ← ユーザーには何も表示されないか、空のページが表示される
```

また、手動の fetch 呼び出しでエラーを握りつぶしている箇所もあります：

```tsx
// skills/page.tsx のカテゴリ取得
fetch("/api/skill-categories")
  .then((r) => r.json())
  .then((data) => setCategories(data))
  .catch(() => {});  // ← エラーを完全に無視！
```

**改善案:**

```tsx
// SWR のエラーを表示する共通パターン
const { data, error, isLoading } = useSWR("/api/...");

if (isLoading) return <LoadingSpinner />;
if (error) return <ErrorMessage message="データの取得に失敗しました" />;
```

SWR の設定ファイル（swr-config.tsx）に **グローバルなエラーハンドラー** を追加するのも有効です：

```tsx
// src/lib/swr-config.tsx
<SWRConfig value={{
  onError: (error) => {
    // 全APIエラーをここで一括キャッチ（ログ送信等）
    console.error("[API Error]", error);
  },
}}>
```

**なぜ必要か:**

ユーザーがボタンを押して何も起きない（エラーが握りつぶされている）と、「壊れている？」「もう一度押すべき？」と混乱します。

エラー表示があれば、ユーザーは **「あ、サーバーに問題があるのか。時間を置いてリトライしよう」** と判断できます。エラーを握りつぶすのは、火災報知器の電池を抜くようなものです。

---

### 7-3. Error Boundary（エラー境界）が不足

**現状の問題:**

Next.js では、ルートセグメントごとに `error.tsx` を置くと、そのセグメント内で発生したエラーをキャッチして表示できます。

しかし現状は **`(main)/error.tsx` の1ファイルしかありません**。これだと、どのページでエラーが起きても同じエラー画面しか出せません。

**改善案:**

主要なルートグループに `error.tsx` を追加：

```
src/app/(main)/
  error.tsx              ← 現存（全体のフォールバック）
  closing/error.tsx      ← 締め管理でエラーが起きたとき専用
  calendar/error.tsx     ← カレンダーでエラーが起きたとき専用
  pl/error.tsx           ← PL管理でエラーが起きたとき専用
```

**なぜ必要か:**

今の状態だと、カレンダーページでエラーが起きたとき **サイドバーやヘッダーも含めて全体がエラー画面になってしまいます**。

ルートセグメントごとに `error.tsx` があれば、**サイドバーは生きたまま、エラーが起きたページだけ「エラーが発生しました」と表示** できます。ユーザーは他のページに移動して作業を続けられます。

---

## 8. セキュリティ

### 8-1. 入力バリデーションの不足

**現状の問題:**

API ルートで、ユーザーからの入力を **「正しいはず」と信じてそのまま使っている** 箇所があります：

```tsx
// attendances/[id]/route.ts 34行目
const confirmStatus = confirmStatusRaw as ConfirmStatus;
// ↑「ConfirmStatus型だよ」と TypeScript に "嘘" をついている
// 実際には任意の文字列が来る可能性がある

// members/route.ts 42行目
...(role ? { userAccount: { role: role as UserRole } } : {}),
// ↑ URL パラメータの role を検証なしに UserRole として扱っている

// cashflow/route.ts 89行目
const company = (url.searchParams.get("company") ?? "boost") as Company;
// ↑ "boost" と "salt2" 以外の文字列も通ってしまう
```

**改善案:**

```tsx
// バリデーション関数を用意する
const VALID_COMPANIES = ["boost", "salt2"] as const;
type Company = typeof VALID_COMPANIES[number];

function parseCompany(value: string | null): Company {
  if (value && VALID_COMPANIES.includes(value as Company)) {
    return value as Company;
  }
  return "boost";  // デフォルト値
}

// 使う側
const company = parseCompany(url.searchParams.get("company"));
```

**なぜ必要か:**

`as SomeType` は TypeScript の機能で、**「このデータは SomeType だと私が保証します」** という意味です。しかし、ユーザーからの入力は何が来るか分かりません。

たとえば `role as UserRole` としていますが、もし誰かが URL に `?role=superadmin` と打ち込んだら、バリデーションなしでそのまま DB クエリに渡されます。今は Prisma が不正な値を弾いてくれますが、**アプリケーション層でも検証するのが防御の基本（多層防御）** です。

玄関のドアに鍵をかけるだけでなく、部屋のドアにも鍵をかけるようなものです。

---

### 8-2. 月のバリデーションが甘い

**現状:**

複数の API ルートで月を正規表現でチェックしていますが：

```tsx
if (!/^\d{4}-\d{2}$/.test(month)) return apiError("...", 400);
```

このパターンは `"2025-13"`（13月）や `"2025-00"`（0月）も通してしまいます。

**改善案:**

```tsx
function isValidMonth(month: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(month)) return false;
  const m = parseInt(month.split("-")[1], 10);
  return m >= 1 && m <= 12;
}
```

---

### 8-3. ログインのレート制限がない

**現状の問題:**

`/api/auth/login` にパスワードの試行回数の制限がありません。

**なぜ必要か:**

レート制限がないと、攻撃者が **1秒間に何百回もパスワードを試す「ブルートフォース攻撃」** が可能です。

**改善案:**

```tsx
// 簡易的な実装例（本番では Redis 等を使用）
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

// 同一IPから5分間に10回以上失敗 → 一時ブロック
```

---

### 8-4. Cron エンドポイントの認証が不完全

**現状の問題:**

```tsx
// cron/weekly-schedule-reminder/route.ts 30行目
if (secret && authHeader !== `Bearer ${secret}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

`CRON_SECRET` 環境変数が未設定（`undefined`）の場合、**`if (secret && ...)` が false になり、認証チェックが完全にスキップされます**。つまり、誰でもこの API を叩けてしまいます。

**改善案:**

```tsx
// secret が未設定なら必ずエラーにする
if (!secret || authHeader !== `Bearer ${secret}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**なぜ必要か:**

開発環境では環境変数を設定し忘れることがよくあります。**「環境変数がないと動かない」のではなく「環境変数がないと誰でもアクセスできる」** のは危険です。「鍵をかけ忘れたら、ドアが勝手に開く」ような設計は避けるべきです。

---

## 9. テスト

### 9-1. テストが1つもない

**現状:**

- テストファイル: **0個**
- テストフレームワーク: **未導入**
- package.json の scripts に `test` コマンド: **なし**
- コード量: 135ファイル、約20,000行

**改善案:**

```
# テストフレームワーク導入
npm install -D vitest @testing-library/react @testing-library/jest-dom

# ディレクトリ構成
src/
  __tests__/
    lib/
      utils.test.ts               ← ユーティリティ関数のテスト
      attendance-summary.test.ts  ← 勤怠集計ロジックのテスト
    api/
      self-reports.test.ts        ← API のバリデーション/レスポンステスト
      closing.test.ts
    hooks/
      use-month-navigation.test.ts
```

**まず書くべきテスト（優先度順）:**

1. **ユーティリティ関数**: `formatCurrency`, `formatDate`, `buildMonths` — 入出力が明確で書きやすい
2. **バリデーション関数**: `validations/member.ts`, `validations/project.ts` — ルールの正しさを担保
3. **API ルートの主要ロジック**: self-reports の % 合計チェック、PL生成の計算ロジック

**なぜ必要か:**

テストがないと、コードを変更するたびに **「この変更で他の機能が壊れていないか」を手動で全ページ確認する必要があります**。

たとえば `formatCurrency` を修正した場合、このアプリでは closing, cashflow, pl, tools 等の多くのページで使われています。テストがあれば、`npm test` 一発で **「全部問題なし」か「ここが壊れた」** が分かります。

テストは **「将来の自分（や他の開発者）への保険」** です。今は問題なく動いていても、機能追加やリファクタリングをするたびに、テストなしでは壊したかどうかの確認に時間がかかります。

---

## 10. アクセシビリティ（a11y）

### 10-1. 現状の問題

全体としては良好ですが、いくつか改善点があります：

**A. モーダルの閉じるボタンに aria-label がない:**

```tsx
// components/ui/modal.tsx
<button onClick={onClose} className="...">
  <X size={18} />  // ← アイコンのみ。スクリーンリーダーは「ボタン」としか読めない
</button>
```

**改善案:**
```tsx
<button onClick={onClose} aria-label="閉じる" className="...">
  <X size={18} />
</button>
```

**B. div に onClick を付けている箇所:**

```tsx
// skills/settings/page.tsx
<div className="..." onClick={(e) => e.stopPropagation()}>
```

div は本来クリックできる要素ではないため、キーボードユーザーは操作できません。

**改善案:** `<button>` に変えるか、`role="button"` と `tabIndex={0}` を追加。

**なぜ必要か:**

アクセシビリティは **「目が見えない人や、マウスが使えない人でもアプリを操作できるようにする」** ための配慮です。

スクリーンリーダー（画面読み上げソフト）を使っている人にとって、`aria-label` がないボタンは **「何のボタンか分からない」** のと同じです。ラベルのない扉と同じで、開けるまで何があるか分かりません。

---

## 11. CI/CD（継続的インテグレーション）

### 11-1. 自動チェックの仕組みがない

**現状:**

- GitHub Actions 等の CI 設定: **なし**
- コードを push しても自動チェック: **されない**
- 本番デプロイの自動化: **なし**

**改善案:**

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run lint        # コードスタイルチェック
      - run: npx tsc --noEmit    # 型チェック
      - run: npm run build       # ビルドが通るか確認
      # - run: npm test          # テスト導入後に追加
```

**なぜ必要か:**

CI がないと、**「lint が通らないコード」や「型エラーのあるコード」がそのまま main ブランチに入ってしまう** 可能性があります。

手動で毎回 `npm run lint && npx tsc --noEmit && npm run build` を実行するのは忘れがちです。CI を設定すると、**push するだけで自動的にチェックが走り、問題があれば赤いバツ印で通知** されます。

工場の品質検査を人の目だけでやるより、自動検査機を通すほうが確実なのと同じです。

---

## 12. ハードコード値

### 12-1. コード内に埋め込まれた値

**現状の問題:**

```tsx
// projects/route.ts 108行目
ipAddress: "127.0.0.1",
// ↑ 監査ログにクライアントIPを記録したいのに、常に localhost になる

// 複数ファイル
const jstOffset = 9 * 60 * 60 * 1000;
// ↑ 日本時間（JST = UTC+9）のオフセットがハードコード。将来多言語対応するときに困る

// tools/route.ts 82行目
companyLabel: "salt2",
// ↑ 常に "salt2" が設定される。ユーザーの所属に関わらない
```

**改善案:**

```tsx
// IPアドレス → リクエストヘッダーから取得
const ipAddress = req.headers.get("x-forwarded-for") ?? "unknown";

// タイムゾーン → 定数化 or 設定化
const TIMEZONE = "Asia/Tokyo";

// 会社ラベル → メンバーのデータから取得
companyLabel: member.companyLabel,
```

**なぜ必要か:**

ハードコード（コードに直接埋め込まれた値）は、**条件が変わったときに探し出して直す必要があります**。特に IP アドレスが常に `"127.0.0.1"` では、監査ログの意味がありません。「誰がいつ操作したか」を追跡できなくなります。

---

## 13. コードレベルのバグ・アンチパターン

### 13-1. 楽観的更新の失敗時ロールバックがない

**該当箇所:** `attendance/page.tsx` 94〜117行目

**現状の問題:**

出退勤ボタンを押すと、**API の結果を待たずに画面を即座に更新** しています（楽観的更新）。これ自体は UX のための良い手法ですが、**API が失敗したとき元に戻す処理がありません**。

```tsx
// 出勤ボタンを押した瞬間
mutateToday(
  { id: "temp", status: "working", clockIn: now, ... },
  { revalidate: false }  // ← API を呼ばずに画面だけ更新
);

try {
  const res = await fetch("/api/attendances/clock-in", { ... });
  if (res.ok) {
    setActionLog((prev) => [`${now} 出勤しました`, ...prev]);
  }
  // ← res.ok === false のとき、何もしない！
  // ← 画面には「出勤済み」と表示されたまま
  await mutateToday();  // ← 再取得するが、ネットワーク障害時はこれも失敗する
} finally {
  setClockingIn(false);
}
```

**なぜ問題か:**

ユーザーが出勤ボタンを押して、画面が「出勤済み」に変わったのに、実は **サーバーには記録されていない** 可能性があります。

たとえるなら、**店のレジで「お支払い完了」と画面に出たのに、実はカード決済が失敗していた** のと同じです。

**改善案:**

```tsx
// 更新前の状態を保存しておく
const previousData = myRecord;

mutateToday({ ...optimisticData }, { revalidate: false });

try {
  const res = await fetch("/api/attendances/clock-in", { ... });
  if (!res.ok) {
    // 失敗したら元に戻す
    mutateToday(previousData, { revalidate: false });
    setClockInError("出勤の記録に失敗しました。もう一度お試しください。");
  }
} catch {
  // ネットワークエラー時も元に戻す
  mutateToday(previousData, { revalidate: false });
  setClockInError("通信エラーが発生しました。");
}
```

同様の問題: `clockOut()`（120〜147行目）、`handleApprove()`（149〜159行目）

---

### 13-2. setTimeout のクリーンアップ漏れ

**該当箇所:**
- `contracts/page.tsx` 143〜146行目
- `mypage/page.tsx` 230行目

**現状の問題:**

```tsx
// contracts/page.tsx
function showToast(msg: string) {
  setToastMsg(msg);
  setTimeout(() => setToastMsg(null), 3000);  // ← タイマーIDを保存していない！
}
```

このコードには2つの問題があります：

**問題A: タイマーの上書き競合**

`showToast()` を1秒以内に3回呼ぶと、3つのタイマーが同時に走ります：
1. 0秒目: `showToast("保存しました")` → タイマー1が3秒後に消す
2. 1秒目: `showToast("削除しました")` → タイマー2が4秒後に消す
3. 2秒目: `showToast("更新しました")` → タイマー3が5秒後に消す

→ 3秒後にタイマー1が発火して **最新のメッセージ「更新しました」が消えてしまう**

**問題B: コンポーネント破棄後のstate更新**

ユーザーが別のページに移動してコンポーネントが破棄された後も、タイマーは動き続けます。3秒後に `setToastMsg(null)` が呼ばれますが、**もう存在しないコンポーネントの state を更新しようとする**（React が警告を出す）。

**なぜ問題か:**

たとえるなら、**「3分後にオーブンの電源を切って」と頼んだのに、頼んだ人がキッチンからいなくなった** のと同じです。タイマーは動き続けますが、電源を切る対象がもうありません。

**改善案:**

```tsx
// useRef でタイマーIDを保持し、前のタイマーをキャンセルする
const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

function showToast(msg: string) {
  if (toastTimerRef.current) clearTimeout(toastTimerRef.current);  // 前のタイマーをキャンセル
  setToastMsg(msg);
  toastTimerRef.current = setTimeout(() => setToastMsg(null), 3000);
}

// コンポーネント破棄時にクリーンアップ
useEffect(() => {
  return () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  };
}, []);
```

> 注: closing/page.tsx ではこのパターンが正しく実装されています（126〜136行目）。他のページでも同じ実装にすべきです。

---

### 13-3. 金額計算の浮動小数点精度問題

**該当箇所:** `api/invoices/route.ts` 7〜14行目

**現状の問題:**

```tsx
function calcAmounts(items: { amount: number; taxable?: boolean }[]) {
  const taxableTotal = items.filter((i) => i.taxable !== false).reduce((s, i) => s + i.amount, 0);
  const nonTaxableTotal = items.filter((i) => i.taxable === false).reduce((s, i) => s + i.amount, 0);
  return {
    amountExclTax: taxableTotal,
    expenseAmount: nonTaxableTotal,
    amountInclTax: Math.round(taxableTotal * 1.1) + nonTaxableTotal,
    //                        ^^^^^^^^^^^^^^^^^ 浮動小数点の罠！
  };
}
```

**なぜ問題か:**

JavaScript の数値は「浮動小数点」で表現されます。これは **小数の計算で誤差が出る** ことがあります：

```js
0.1 + 0.2  // = 0.30000000000000004（0.3ではない！）
```

請求金額の計算で 1円のズレが出ると：
- 請求書の金額が合わない
- 会計ソフトとの突合でエラーになる
- 税務処理で問題になる可能性がある

**改善案:**

```tsx
// 方法A: 整数（円単位）で計算し、最後にまとめて丸める
// 現状もamountは整数のはずだが、将来的に安全にするなら：
const taxAmount = Math.floor(taxableTotal * 10 / 100);  // 消費税を整数で計算
const amountInclTax = taxableTotal + taxAmount + nonTaxableTotal;

// 方法B: Prisma の Decimal 型をそのまま使う（DB側で計算）
```

> 注: 現状は金額が整数（円単位）なので `Math.round(taxableTotal * 1.1)` で実害はありません。しかし、将来的に小数が混入する可能性（時給×時間 等）があるため、整数演算に統一しておくのが安全です。

---

### 13-4. カレンダーの TODAY 変数がグローバル可変

**該当箇所:** `calendar/page.tsx` 21行目, 450行目

**現状の問題:**

```tsx
// モジュールのトップレベル（グローバル）
let TODAY = ""; // set on client after hydration

// useEffect 内で代入
useEffect(() => {
  const now = new Date();
  TODAY = localDateStr(now);  // ← グローバル変数を書き換え
  setAnchor(now);
}, []);
```

**なぜ問題か:**

1. **グローバル変数の書き換えは React のルール違反**: React は「コンポーネント外の変数を副作用で変更しない」ことを前提にしています。`TODAY` はモジュールレベルの `let` なので、**複数回レンダリングしても1つの値を共有** します。

2. **SSR（サーバーサイドレンダリング）との不整合**: サーバーでは `TODAY = ""` のまま。クライアントでは `"2026-03-14"` になる。同じコンポーネントなのに **サーバーとクライアントで異なる出力** になり、ハイドレーションエラーの原因になりえます。

たとえるなら、**黒板に書いた答えを途中で消して書き直す** ようなものです。先生（サーバー）と生徒（クライアント）が同じ問題を解いているのに、黒板の答えが途中で変わると混乱します。

**改善案:**

```tsx
// state で管理する
const [today, setToday] = useState("");

useEffect(() => {
  setToday(localDateStr(new Date()));
}, []);
```

---

### 13-5. エラー時の res.json() パース失敗

**該当箇所:** 複数の API 呼び出し

**現状の問題:**

```tsx
// 複数ページで見られるパターン
const res = await fetch("/api/...", { method: "POST", ... });
const data = await res.json();  // ← res が 500 で HTML を返す場合、ここで例外
```

サーバーが 500 エラーを返した場合、レスポンスが JSON ではなく HTML（エラーページ）の場合があります。その場合 `res.json()` は `SyntaxError` を投げます。

**改善案:**

```tsx
const res = await fetch("/api/...", { method: "POST", ... });
if (!res.ok) {
  const errorData = await res.json().catch(() => ({}));  // パース失敗に備える
  setError(errorData?.error?.message ?? "エラーが発生しました");
  return;
}
const data = await res.json();
```

> 注: mypage/page.tsx 232行目では `.catch(() => ({}))` でこの対策がされています。他のページにも同じパターンを適用すべきです。

---

## 改善適用の優先順位

| 優先度 | 改善項目 | 工数 | なぜこの優先度か |
|--------|---------|------|-----------------|
| **緊急** | 8-4. Cron認証の修正 | 極小 | 環境変数未設定で認証がスキップされる。1行の修正で済む |
| **緊急** | 8-1. 入力バリデーション（`as` キャスト修正） | 小 | 5箇所の `as` キャストが検証なし。セキュリティリスク |
| **緊急** | 13-1. 楽観的更新のロールバック追加 | 小 | 出退勤でAPI失敗時に画面が嘘の状態になる |
| **高** | 13-4. カレンダー TODAY グローバル変数の修正 | 極小 | SSRハイドレーション不整合の原因 |
| **高** | 13-2. setTimeout クリーンアップ | 極小 | メモリリーク・トースト表示バグ。contracts等2箇所 |
| **高** | 7-1. APIエラーレスポンスの統一 | 小 | 200で空配列を返すパターンはバグの温床 |
| **高** | 7-2. フロントエンドのエラー表示 | 小 | エラーの握りつぶしはユーザー体験を大きく損なう |
| **高** | 2-1. 巨大ファイル分割 | 中 | 他の全改善の前提。分割しないとフック抽出も memo 適用もできない |
| **高** | 3-1. カスタムフック導入 | 中 | ロジック/UIの分離はコードの理解しやすさに直結 |
| **高** | 6-2. 再レンダリング最適化 | 中 | ユーザーが体感する表示速度に直結 |
| **高** | 9-1. テスト導入 | 中 | 20,000行にテスト0。リファクタリングの安全網がない |
| **中** | 4-1. 型定義の外部化 | 小 | 型の重複排除。バグ予防に効果あり |
| **中** | 5-1. 定数ファイル化 | 小 | 定数の重複排除。作業量が少なく効果が高い |
| **中** | 2-2. ローディング統一 | 小 | コード量削減。変更箇所は多いが各箇所は簡単 |
| **中** | 3-2. API呼び出し抽出 | 中 | エラーハンドリングの統一 |
| **中** | 7-3. Error Boundary 追加 | 小 | エラー時にサイドバーが消えるのを防止 |
| **中** | 11-1. CI/CD 導入 | 小 | lint/型チェック/ビルドの自動化でミスを防止 |
| **中** | 8-3. ログインのレート制限 | 中 | ブルートフォース攻撃への防御 |
| **中** | 10-1. アクセシビリティ改善 | 小 | モーダルの aria-label 等、影響箇所は少ない |
| **低** | 1-1. ルートグループリネーム | 極小 | 改善効果は命名の明確化のみ。急がなくてよい |
| **低** | 1-3. lib/ の責務分割 | 小 | 構造の明確化。既存コードが壊れるリスクは低い |
| **低** | 4-2. API型の共有 | 中 | 理想的だが、現状困っていなければ後回しでOK |
| **低** | 12-1. ハードコード値の修正 | 小 | IP アドレス等。優先度は低いが監査ログの正確性に影響 |

---

## 推奨実施順序

### Phase 0: 緊急修正（セキュリティ）

**すぐに直すべき問題** です。各修正は1〜数行の変更で済みます。

1. Cron エンドポイントの認証修正（`if (secret &&` → `if (!secret ||`）
2. API ルートの `as` キャスト5箇所にバリデーション追加
3. 月の正規表現バリデーション強化（13月等を弾く）
4. 出退勤の楽観的更新に失敗時ロールバックを追加
5. カレンダーの `let TODAY` をグローバル変数から state に変更
6. contracts/mypage の `setTimeout` にクリーンアップ追加

### Phase 1: 下準備（型・定数・共通コンポーネント）

**「移動するだけ」の安全な作業** から始めます。コードの動きは変わらず、整理だけです。

4. `src/types/` を作成 → 各ページのインライン型をここに移動
5. `src/constants/` を作成 → 散在している定数をここに集約
6. `LoadingSpinner` / `EmptyState` / `ErrorMessage` 共通コンポーネントを作成
7. API エラーレスポンスのフォーマットを統一（`apiError` ヘルパー関数）

### Phase 2: ロジックの分離（フック・API関数）

**「ロジックを切り出す」作業** です。表示は変わりませんが、コードの構造が改善されます。

8. `src/hooks/` を作成 → closing, calendar, contracts のロジックを抽出
9. `src/lib/api/` を作成 → fetch 呼び出しを集約
10. フロントエンドにエラー表示を追加（SWR の `error` を使う）

### Phase 3: コンポーネント分割と最適化

**「ファイルを分割して」パフォーマンスを改善** します。

11. closing/page.tsx → `_components/` に分割
12. contracts, mypage, calendar 等も同様に分割
13. React.memo を適用 + state のスコープを限定
14. Error Boundary を主要ルートセグメントに追加

### Phase 4: 品質基盤の構築

**テストと自動チェック** を導入して、今後の変更を安全に行える基盤を作ります。

15. Vitest 導入 + ユーティリティ関数のテスト
16. バリデーション関数のテスト
17. GitHub Actions で lint → 型チェック → ビルド → テストの自動実行

### Phase 5: ディレクトリ整理（リネーム・移動）

**「名前を変えるだけ」の整理** を行います。急ぎではないので、余裕があるときに。

18. `(main)` → `(authenticated)` / `(unauthenticated)` にリネーム
19. `lib/auth-context.tsx` → `contexts/` に移動
20. `lib/slack.ts` 等 → `services/` に移動

---

## まとめ: 改善の共通テーマ

全ての改善案は、以下の4つの原則に基づいています：

1. **安全第一**: セキュリティの穴は最優先で塞ぐ。入力は信用しない、エラーは握りつぶさない
2. **DRY（同じことを繰り返さない）**: 同じコード/型/定数を1箇所にまとめ、変更漏れを防ぐ
3. **関心の分離**: 「見た目」と「ロジック」を分け、それぞれを理解しやすく、変更しやすくする
4. **影響範囲の最小化**: state 変更やコード変更の影響が、必要な部分だけに留まるようにする
