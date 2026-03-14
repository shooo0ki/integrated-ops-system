# コード vs 仕様 レビュー・課題一覧

> **目的**: 要件定義書・DB設計書と実際のコードを突き合わせ、問題点を洗い出す。
> **形式**: 課題 → 原因 → 解決策
> **作成日**: 2026-03-14
> **参照ドキュメント**:
> - [要件定義書](../requirements/reverse-engineered/requirements.md)
> - [DB設計書](../requirements/reverse-engineered/database-design.md)

---

## サマリー

| 深刻度 | 件数 | 代表例 |
|--------|------|--------|
| **致命的** | 2 | エラー時に200を返すAPI、Cron認証バイパス |
| **高** | 6 | ステータス Enum 不整合、監査ログ欠落、未使用DBモデル |
| **中** | 8 | Enum バリデーション不足、try-catch 欠如、未実装機能の残骸 |
| **低** | 5 | 未使用カラム、通知設定UI残骸、死コード |

---

## 1. 致命的な課題

### 1-1. `/api/closing` がエラー時に HTTP 200 を返す

| 項目 | 内容 |
|------|------|
| **課題** | `/api/closing` の GET ハンドラで例外が発生すると、空配列 `[]` を HTTP 200 で返す |
| **該当箇所** | `src/app/api/closing/route.ts` 152〜155行目 |
| **原因** | catch ブロックで `console.error` のみ行い、レスポンスに `{ status: 500 }` を設定していない |
| **影響** | フロントエンドはエラーと「データなし」を区別できない。DB障害時にも正常画面が表示され、管理者が気づかない |

**現状コード:**
```tsx
} catch (error) {
  console.error("Closing API error:", error);
  return NextResponse.json([]);  // ← status: 200 で空配列
}
```

**解決策:**
```tsx
} catch (error) {
  console.error("Closing API error:", error);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "データの取得に失敗しました" } },
    { status: 500 }
  );
}
```

---

### 1-2. Cron エンドポイントの認証がバイパス可能

| 項目 | 内容 |
|------|------|
| **課題** | `CRON_SECRET` 環境変数が未設定の場合、認証チェックが完全にスキップされる |
| **該当箇所** | `src/app/api/cron/weekly-schedule-reminder/route.ts` 30行目 |
| **原因** | `if (secret && authHeader !== ...)` の条件で `secret` が falsy なら全体が false |
| **影響** | 環境変数未設定の開発/ステージング環境で、誰でも Cron API を叩ける |

**解決策:**
```tsx
if (!secret || authHeader !== `Bearer ${secret}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

---

## 2. ステータス Enum の不整合（高）

### 2-1. ConfirmStatus: フロントエンドとDBで値が異なる

| 項目 | 内容 |
|------|------|
| **課題** | フロントエンドが使う ConfirmStatus の値と DB の Enum 値が一致しない |
| **該当箇所** | `src/app/(main)/closing/page.tsx` 17行目 vs `prisma/schema.prisma` ConfirmStatus enum |

| フロントエンド値 | DB Enum 値 | 対応関係 |
|------------------|-----------|----------|
| `"not_sent"` | ― | API が計算で生成（DB に存在しない） |
| `"waiting"` | ― | API が計算で生成（DB に存在しない） |
| `"confirmed"` | `confirmed` | 一致 |
| `"forced"` | ― | API が計算で生成（DB に存在しない） |
| ― | `unconfirmed` | フロントエンド未参照 |
| ― | `approved` | フロントエンド未参照 |
| ― | `rejected` | フロントエンド未参照 |

**原因:** `/api/closing` の GET が、DB の ConfirmStatus をそのまま返さず、勤怠データの集計結果から `"not_sent"`, `"waiting"`, `"confirmed"`, `"forced"` を動的に計算している。これは「メンバーの月次確認状態」であり、個別勤怠レコードの `ConfirmStatus` とは別概念。

**解決策:**
- 締め管理の月次確認状態を型として明示的に定義する（`ClosingConfirmStatus` 等）
- DB の `ConfirmStatus` とは別の名前にして、混同を防ぐ
- 型定義を `src/types/closing.ts` に切り出す

---

### 2-2. InvoiceStatus: フロントエンド5値 vs DB 3値

| 項目 | 内容 |
|------|------|
| **課題** | フロントエンドが5つのステータスを使うが、DB Enum は3つしかない |
| **該当箇所** | `src/app/(main)/closing/page.tsx` 18行目、70〜75行目 vs `prisma/schema.prisma` InvoiceStatus enum |

| フロントエンド値 | DB Enum 値 | 対応関係 |
|------------------|-----------|----------|
| `"none"` | ― | 請求書が未作成（DB にレコードなし） |
| `"generated"` | `unsent` | 作成済み・未提出 |
| `"sent"` | `sent` | 提出済み |
| `"approved"` | ― | **API が一度も返さない死コード** |
| `"accounting_sent"` | `confirmed` | LayerX 送付済み |

**原因:** API が DB の値をフロントエンド用に変換しているが、`"approved"` を返すパスが存在しない。フロントエンドの `receiptConfig` に定義はあるが到達しない。

**解決策:**
- `"approved"` を削除するか、ビジネスフローに「承認済み」ステップが必要なら DB Enum に追加
- フロントエンドの型定義を API レスポンスから自動導出（`as const` + `typeof`）

---

## 3. DB スキーマと実装のギャップ（高）

### 3-1. 使われていない DB モデル: PositionRequiredSkill

| 項目 | 内容 |
|------|------|
| **課題** | `PositionRequiredSkill` モデルが定義されているが、コード上の参照がゼロ |
| **該当箇所** | `prisma/schema.prisma` 293〜306行目 |
| **原因** | ポジションに必要なスキルレベルを定義する機能が設計されたが、UI・API ともに未実装 |
| **影響** | スキーマにゴーストテーブルが存在。マイグレーション・型生成のコスト |

**解決策:**
- 将来実装予定 → スキーマにコメント `// TODO: スキルマッチング機能で使用予定` を追加
- 実装予定なし → マイグレーションで削除

---

### 3-2. 監査ログの記録が一部のAPIのみ

| 項目 | 内容 |
|------|------|
| **課題** | `AuditLog` モデルが存在するが、ログを書き込む API が2つしかない |
| **該当箇所** | `prisma/schema.prisma` 539〜557行目 |

| API | 監査ログ記録 |
|-----|-------------|
| `PATCH /api/members/[id]` | ✓ 記録あり |
| `DELETE /api/members/[id]` | ✓ 記録あり |
| `PUT /api/projects/[id]` | ✓ 記録あり |
| `DELETE /api/projects/[id]` | ✓ 記録あり |
| `POST /api/invoices` | ✗ 記録なし |
| `DELETE /api/invoices/[id]` | ✗ 記録なし |
| `POST /api/self-reports` | ✗ 記録なし |
| `POST /api/members/[id]/skills` | ✗ 記録なし |
| `POST /api/members/[id]/tools` | ✗ 記録なし |
| `DELETE /api/skill-categories/[id]` | ✗ 記録なし |

**原因:** 初期に AuditLog を導入したが、全 API に適用する前に他の機能開発に移った。

**解決策:**
- Prisma middleware または共通ヘルパー関数 `writeAuditLog()` を作成
- 最低限、CREATE/DELETE 操作には全て適用
- IPアドレスは `req.headers.get("x-forwarded-for")` から取得（現状 `"127.0.0.1"` 固定）

---

### 3-3. 未使用の DB カラム

| カラム | テーブル | 状況 |
|--------|----------|------|
| `profile_image_url` | members | コード上の参照ゼロ。アバターは名前の頭文字で表示。 |
| `file_hash` | member_contracts | コード上の参照ゼロ。ファイル整合性チェック未実装。 |
| `file_path` | invoices | GET で返されるが常に null。PDF 保存処理が未実装。 |
| `cf_cash_out_outsourcing` | pl_records | コード上の参照ゼロ。CF 外注費の追跡なし。 |

**原因:** スキーマ設計時に将来機能を見越してカラムを追加したが、実装されていない。

**解決策:**
- 各カラムに `// TODO: 未実装` コメントを追加
- またはマイグレーションで nullable → 削除（使わないなら早めに除去）

---

## 4. バリデーション不足（中）

### 4-1. Enum 値が検証なしでキャストされている

| 該当箇所 | コード | リスク |
|----------|--------|--------|
| `api/tools/route.ts` 26行目 | `company as Company` | 不正な company 値が Prisma に渡される |
| `api/cashflow/route.ts` 89行目 | `(company ?? "boost") as Company` | 同上 |
| `api/members/route.ts` 42行目 | `role as UserRole` | 不正な role 値でフィルタ |
| `api/attendances/[id]/route.ts` 34行目 | `confirmStatusRaw as ConfirmStatus` | 不正なステータスで DB 更新 |
| `api/closing/route.ts` | `company as Company` | 同上 |

**原因:** TypeScript の `as` キャストは実行時チェックを行わない。開発時の型安全に頼っているが、外部入力には無効。

**解決策:**
```tsx
// 共通バリデーション関数を作成
const VALID_COMPANIES = ["boost", "salt2"] as const;
type Company = typeof VALID_COMPANIES[number];

function parseCompany(value: string | null): Company | null {
  if (value && VALID_COMPANIES.includes(value as Company)) return value as Company;
  return null;
}
```

---

### 4-2. 月フォーマットの正規表現が不完全

| 項目 | 内容 |
|------|------|
| **課題** | 複数の API で `/^\d{4}-\d{2}$/` を使用しているが、13月や0月を通す |
| **該当箇所** | 複数の API ルート（self-reports, closing, pl-records 等） |

**解決策:**
```tsx
function isValidMonth(month: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(month)) return false;
  const m = parseInt(month.split("-")[1], 10);
  return m >= 1 && m <= 12;
}
```

---

## 5. エラーハンドリングの欠如（中）

### 5-1. 外部 API 呼び出しに try-catch がない

| 該当箇所 | 外部呼び出し | リスク |
|----------|-------------|--------|
| `api/invoices/[invoiceId]/accounting/route.ts` 43行目 | `generateInvoiceExcel()` | 例外で 500 返却、ステータス更新が中途半端に |
| `api/invoices/[invoiceId]/accounting/route.ts` 61行目 | `sendEmail()` | メール送信失敗でクラッシュ |
| `api/members/[id]/contracts/[cId]/send/route.ts` 68行目 | `sendEnvelope()` | DocuSign 送信失敗でクラッシュ |

**原因:** 外部サービス呼び出しを「成功する前提」で記述している。

**解決策:**
```tsx
try {
  const { envelopeId } = await sendEnvelope(...);
  await prisma.memberContract.update({ ... });
} catch (error) {
  console.error("DocuSign send failed:", error);
  return NextResponse.json(
    { error: { code: "EXTERNAL_ERROR", message: "署名依頼の送信に失敗しました" } },
    { status: 502 }
  );
}
```

---

### 5-2. フロントエンドのエラー握りつぶし

| 該当箇所 | コード | 問題 |
|----------|--------|------|
| `skills/page.tsx` | `.catch(() => {})` | カテゴリ取得失敗を完全に無視 |
| 複数ページ | `const data = await res.json()` | 500 で HTML が返る場合に SyntaxError |

**解決策:**
- `.catch(() => {})` → `.catch((e) => { setError("取得に失敗しました"); console.error(e); })`
- `res.json()` → `res.json().catch(() => ({}))` でパース失敗に備える

---

## 6. 機能の不整合（中）

### 6-1. 通知設定 UI が「準備中」のまま放置

| 項目 | 内容 |
|------|------|
| **課題** | マイページに「Slack通知」「メール通知」のトグルが表示されるが、すべて「準備中」 |
| **該当箇所** | `src/app/(main)/mypage/page.tsx` 643行目、650行目 |
| **原因** | UI を先行して作成したが、バックエンドの通知設定 API が未実装 |
| **影響** | ユーザーが機能を期待するが実際には動作しない |

**解決策:**
- A案: バックエンドに `notification_preferences` テーブルと API を追加して実装
- B案: UIから「準備中」セクションを完全に削除（機能ができるまで見せない）

---

### 6-2. 請求書 PDF のファイルパスが常に null

| 項目 | 内容 |
|------|------|
| **課題** | Invoice テーブルに `file_path` カラムがあるが、PDF 保存処理が未実装 |
| **該当箇所** | `prisma/schema.prisma` invoices.file_path |
| **原因** | 請求書の Excel 生成 (`generateInvoiceExcel()`) は実装済みだが、結果をファイルとして保存する処理がない |
| **影響** | `file_path` が常に null。過去の請求書を再ダウンロードする手段がない |

**解決策:**
- 生成した Excel/PDF をストレージ（Supabase Storage 等）に保存し、`file_path` を更新

---

### 6-3. PLレコードの外注費が常にゼロ

| 項目 | 内容 |
|------|------|
| **課題** | `cost_outsourcing` が PL 自動生成時に常に 0 にセットされる |
| **該当箇所** | `src/app/api/pl-records/generate/route.ts` 175行目 |
| **原因** | 外注費の入力元（外注先マスタ等）が存在しない |
| **影響** | 外注を使うプロジェクトの PL が正確でない |

**解決策:**
- 手動入力で対応する場合: PL 編集画面に外注費入力欄を追加（一部は既に存在）
- 自動計算で対応する場合: 外注先テーブルを追加し、PL 生成時に集計

---

## 7. 認可の弱点（中）

### 7-1. ツール一覧 API がロールチェックなし

| 項目 | 内容 |
|------|------|
| **課題** | `GET /api/members/[id]/tools` が認証チェックのみで、ロールチェックがない |
| **該当箇所** | `src/app/api/members/[id]/tools/route.ts` 22〜34行目 |
| **原因** | `if (!user)` のみで、`user.role` の検証がない |
| **影響** | member ロールのユーザーが他メンバーのツール情報（SaaS 名、プラン、月額）を閲覧可能 |

**解決策:**
```tsx
if (user.role === "member" && user.memberId !== params.id) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

---

## 8. データ整合性の懸念（中）

### 8-1. MonthlyAttendanceSummary の更新タイミング

| 項目 | 内容 |
|------|------|
| **課題** | 勤怠サマリーの再計算が一部の操作パスで呼ばれていない可能性 |

| 操作 | recalcAttendanceSummary 呼び出し |
|------|-------------------------------|
| 出勤打刻 (clock-in) | ✓ |
| 退勤打刻 (clock-out) | ✓ |
| 新規勤怠登録 (POST /attendances) | ✓ |
| 勤怠編集 (PUT /attendances/[id]) | ✓ |
| 強制確認 (force-confirm) | ✗ ただし workMinutes は変更しないため影響なし |
| 勤怠承認 (PATCH /attendances/[id]) | ✗ confirmStatus のみ変更なので影響なし |
| 直接 DB 操作 | ✗ サマリーと乖離するリスク |

**原因:** 強制確認と承認は `confirmStatus` のみ変更するため、workMinutes に影響しない。現時点では問題ないが、将来 workMinutes を変更する操作が追加された場合にリスク。

**解決策:**
- `recalcAttendanceSummary` が呼ばれるべきケースを明文化
- 勤怠関連 API のすべての更新パスで「workMinutes が変わったら再計算」のガードを入れる

---

### 8-2. 自己申告の時間計算が勤怠サマリーに依存

| 項目 | 内容 |
|------|------|
| **課題** | `POST /api/self-reports` で `reportedHours` を計算する際、`MonthlyAttendanceSummary.totalMinutes` を参照する |
| **該当箇所** | `src/app/api/self-reports/route.ts` 193〜198行目 |
| **原因** | 非正規化テーブルへの依存 |
| **影響** | サマリーが古い場合、申告時間が不正確になる |

**解決策:**
- 自己申告 API 内でサマリーの鮮度チェック（`updatedAt` とクライアントの月末日を比較）
- またはサマリーではなく `attendances` テーブルから直接集計

---

## 9. フロントエンドの課題（低〜中）

### 9-1. 楽観的更新のロールバック不足

| 項目 | 内容 |
|------|------|
| **課題** | 出退勤の楽観的更新で、API 失敗時に UI を元に戻す処理がない |
| **該当箇所** | `src/app/(main)/attendance/page.tsx` 94〜117行目 |
| **影響** | API 失敗時に「出勤済み」と表示されるが、サーバーには記録されていない |

**解決策:** 更新前データを保存し、失敗時に `mutate(previousData, { revalidate: false })` で復元。

---

### 9-2. カレンダーのグローバル変数

| 項目 | 内容 |
|------|------|
| **課題** | `let TODAY = ""` がモジュールスコープで定義され、useEffect 内で書き換えられている |
| **該当箇所** | `src/app/(main)/calendar/page.tsx` 21行目、450行目 |
| **影響** | React のルール違反。SSR 時の不整合リスク。 |

**解決策:** `useState` + `useEffect` に変更。

---

### 9-3. setTimeout のクリーンアップ漏れ

| 該当箇所 | 問題 |
|----------|------|
| `contracts/page.tsx` 143〜146行目 | `showToast()` のタイマーが上書き競合＋コンポーネント破棄後に発火 |
| `mypage/page.tsx` 230行目 | 同上 |

**解決策:** `useRef` でタイマー ID を保持し、前のタイマーをキャンセル。`useEffect` の return で cleanup。

---

## 10. サイドバーナビゲーションの設計意図

| 項目 | 内容 |
|------|------|
| **課題ではないが注意点** | サイドバーには8項目しかないが、実際には25ページが存在する |

**admin/manager のサイドバー:**
- ダッシュボード、マイページ、設定

**member のサイドバー:**
- 打刻、カレンダー、勤務予定、請求管理、PLサマリー、マイページ

**サイドバーに無いページ（17ページ）:**
- `/attendance/list`, `/contracts`, `/evaluation`, `/members`, `/members/new`, `/members/[id]`, `/pl/project`, `/pl/cashflow`, `/projects`, `/projects/new`, `/projects/[id]`, `/projects/[id]/assign`, `/skills`, `/skills/settings`, `/skills/evaluation/[memberId]`, `/tools`, `/workload`

**原因:** admin/manager はダッシュボードのグリッドから各ページへ遷移する設計。サイドバーは最低限のナビゲーションのみ。

**懸念:** ダッシュボードのグリッドに含まれないページ（`/attendance/list` 等）は、他ページからのリンクでしか到達できない。直接 URL 入力以外の導線がない場合がある。

---

## 課題の優先順位と対応計画

### Phase 0: 即時対応（致命的）

| # | 課題 | 工数 | 対応方針 |
|---|------|------|----------|
| 1 | 1-1. closing API の 200 返却 | 極小 | catch ブロックに `{ status: 500 }` 追加 |
| 2 | 1-2. Cron 認証バイパス | 極小 | `if (secret &&` → `if (!secret \|\|` に変更 |

### Phase 1: 早期対応（高）

| # | 課題 | 工数 | 対応方針 |
|---|------|------|----------|
| 3 | 2-1. ConfirmStatus 不整合 | 小 | 締め管理用の型を別途定義 |
| 4 | 2-2. InvoiceStatus 不整合 | 小 | 死コード `"approved"` を削除 |
| 5 | 3-2. 監査ログの欠落 | 中 | 共通ヘルパー関数を作成し、全 CUD 操作に適用 |
| 6 | 3-1. 未使用 DB モデル | 小 | コメント追加 or 削除判断 |
| 7 | 4-1. Enum バリデーション | 小 | 共通パーサー関数を5箇所に適用 |

### Phase 2: 中期対応（中）

| # | 課題 | 工数 | 対応方針 |
|---|------|------|----------|
| 8 | 4-2. 月フォーマット検証 | 極小 | `isValidMonth()` を共通化 |
| 9 | 5-1. 外部 API の try-catch | 小 | 3箇所に try-catch 追加 |
| 10 | 5-2. フロントエンドのエラー握りつぶし | 小 | `.catch(() => {})` を修正 |
| 11 | 6-1. 通知設定 UI | 極小 | 「準備中」セクションを削除 |
| 12 | 7-1. ツール API 認可 | 極小 | ロールチェック1行追加 |
| 13 | 9-1. 楽観的更新ロールバック | 小 | 3箇所に失敗時復元ロジック追加 |

### Phase 3: 低優先度

| # | 課題 | 工数 | 対応方針 |
|---|------|------|----------|
| 14 | 3-3. 未使用カラム整理 | 小 | コメント or マイグレーション削除 |
| 15 | 6-2. 請求書 PDF 保存 | 中 | Supabase Storage 連携 |
| 16 | 6-3. 外注費入力 | 中 | PL 編集画面に入力欄追加 |
| 17 | 9-2. カレンダー TODAY | 極小 | useState に変更 |
| 18 | 9-3. setTimeout cleanup | 極小 | useRef + useEffect cleanup |

---

## 付録: 要件定義書に記載があるが実装が不完全な機能

| 要件定義書の記載 | 実装状況 | 詳細 |
|------------------|----------|------|
| ポジション必要スキル紐付け | DB のみ | `PositionRequiredSkill` テーブルは存在するが UI・API なし |
| プロフィール画像 | DB のみ | `profile_image_url` カラムは存在するが参照なし |
| 請求書 PDF 保存 | 部分的 | Excel 生成はあるが `file_path` に保存する処理なし |
| 契約書ハッシュ検証 | DB のみ | `file_hash` カラムは存在するが参照なし |
| 通知設定（Slack/メール） | UI のみ | 「準備中」表示。バックエンドなし |
| 監査ログ（全操作） | 部分的 | メンバー・プロジェクトの更新/削除のみ。請求書・スキル等は未記録 |
| IP アドレス記録 | 形だけ | `"127.0.0.1"` 固定。実際のクライアント IP を取得していない |
| CF 外注費追跡 | DB のみ | `cf_cash_out_outsourcing` カラムは存在するが参照なし |
