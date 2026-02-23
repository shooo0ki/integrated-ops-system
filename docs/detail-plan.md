# 実装詳細計画（縦切りスライス）

> 作成日: 2026-02-21
> 参照: docs/requirements/database/database-design.md / docs/requirements/api/api-design.md / docs/requirements/requirements-v2/*.md

---

## ビルドゲート確認

| ゲート | 状態 |
|--------|------|
| docs/requirements/** が揃っている | ✅ 完了（database-design.md / api-design.md / requirements-v2 26画面） |
| detail-plan.md が存在する | ✅ 本ファイル |
| npm run dev が正常動作 | ✅ 確認済み |

---

## 技術スタック（追加分）

| パッケージ | バージョン | 用途 |
|---|---|---|
| `prisma` | ^5.x | ORM CLI |
| `@prisma/client` | ^5.x | DB クライアント |
| `iron-session` | ^8.x | Cookie セッション管理 |
| `bcryptjs` | ^2.x | パスワードハッシュ化 |
| `@types/bcryptjs` | ^2.x | 型定義 |
| `zod` | ^3.x | バリデーション |

**インストールコマンド（ユーザー実行）:**
```bash
npm install @prisma/client iron-session bcryptjs zod
npm install -D prisma @types/bcryptjs
```

---

## Phase 1: 認証 + メンバー + スキル

### [F-01] Foundation — Prisma schema + seed

**目的:** DB 接続基盤を確立する

**成果物:**
- `prisma/schema.prisma` — 20テーブル全定義
- `prisma/seed.ts` — Phase 1 用テストデータ（メンバー5名、スキル10件）
- `src/lib/db.ts` — Prismaクライアントシングルトン
- `.env.example` — 環境変数テンプレート

**完了条件:**
- `npx prisma migrate dev` が成功する
- `npx prisma db seed` でテストデータが投入される
- `user_accounts` に admin / manager / employee / intern 各1名が存在する

---

### [F-02] Auth Layer — ログイン/セッション API + middleware

**目的:** 実認証に切り替える（デモ Context を廃止）

**成果物:**
- `src/lib/auth.ts` — iron-session 設定（SESSION_SECRET, cookie 設定）
- `src/app/api/auth/login/route.ts` — POST /api/auth/login（bcrypt照合）
- `src/app/api/auth/logout/route.ts` — POST /api/auth/logout
- `src/app/api/auth/session/route.ts` — GET /api/auth/session
- `src/middleware.ts` — 未認証リダイレクト（/login へ）
- `src/lib/auth-context.tsx` — モックデモから API 呼び出しに移行

**完了条件:**
- 正しいメール+パスワードでログインしてダッシュボードに遷移する
- 誤りの場合「メールアドレスまたはパスワードが正しくありません」が表示される
- 未認証でアクセスするとログイン画面にリダイレクトされる
- GET /api/auth/session が 200 でセッション情報を返す

---

### [S-01] Member List & Create — M1-01 / M1-03（登録）

**目的:** メンバー一覧・登録を実データに接続する

**成果物:**
- `src/app/api/members/route.ts` — GET /api/members（フィルター: status/company/q）/ POST /api/members
- `src/lib/validations/member.ts` — CreateMemberSchema（Zod）
- `src/app/(main)/members/page.tsx` — モック→fetch に差し替え

**完了条件:**
- メンバー一覧が DB データを表示する
- 管理者が新規メンバーを登録すると DB に保存される
- メール重複時に 409 が返り画面にエラーメッセージが表示される

---

### [S-02] Member Detail & Edit + Tools — M1-02 / M1-03（編集）

**目的:** メンバー詳細・編集・ツール管理を実データに接続する

**成果物:**
- `src/app/api/members/[id]/route.ts` — GET/PUT/DELETE /api/members/:id
- `src/app/api/members/[id]/tools/route.ts` — GET/POST /api/members/:id/tools
- `src/app/api/members/[id]/tools/[toolId]/route.ts` — PUT/DELETE
- `src/app/(main)/members/[id]/page.tsx` — 差し替え
- `src/app/(main)/members/new/page.tsx` — 差し替え

**完了条件:**
- メンバー詳細が DB データを表示する（ロール別フィールド制御あり）
- 管理者がメンバー情報を編集して保存できる
- 管理者がツールを追加・編集・削除できる

---

### [S-03] Skill Matrix & Settings — M2-01 / M2-02

**目的:** スキルマトリクスを実データに接続する

**成果物:**
- `src/app/api/skill-categories/route.ts` — GET/POST
- `src/app/api/skill-categories/[id]/route.ts` — PUT/DELETE
- `src/app/api/skill-matrix/route.ts` — GET（フィルター: categoryId/minLevel/company）
- `src/app/(main)/skills/page.tsx` — 差し替え
- `src/app/(main)/skills/settings/page.tsx` — 差し替え

**完了条件:**
- スキルマトリクスが DB のスキルデータを表示する
- 管理者がカテゴリ・スキルを追加・編集・削除できる

---

### [S-04] Skill Evaluation — M2-03

**目的:** スキル評価入力を実データに接続する

**成果物:**
- `src/app/api/members/[id]/skills/route.ts` — GET/POST（追記型）
- `src/app/(main)/skills/evaluation/[memberId]/page.tsx` — 差し替え

**完了条件:**
- スキル評価を保存すると `member_skills` に追記される
- 評価履歴が最新順で表示される
- 管理者・マネージャーのみ編集可、社員・インターンは閲覧のみ

---

## Phase 2: プロジェクト + 勤怠（Phase 1 完了後に計画詳細化）

| スライス | 対象画面 | 主なAPI |
|---------|---------|--------|
| [S-05] Project CRUD | M3-01, M3-02, M3-03 | GET/POST/PUT /api/projects |
| [S-06] Assignment | M3-04 | GET/POST /api/projects/:id/assignments |
| [S-07] Workload | M3-05 | GET/PUT /api/workload |
| [S-08] Work Schedule | M4-02 | PUT /api/members/:id/work-schedules |
| [S-09] Timeclock | M4-03 | POST /api/attendances/clock-in, clock-out |
| [S-10] Attendance List | M4-04 | GET/PUT /api/attendances |

## Phase 3: 請求 + PL/CF（Phase 2 完了後に計画詳細化）

| スライス | 対象画面 | 主なAPI |
|---------|---------|--------|
| [S-11] Monthly Closing | M5-01 | POST /api/monthly-closing/aggregate |
| [S-12] Invoice | M5-02 | GET/POST /api/invoices |
| [S-13] Project PL | M6-01 | GET/PUT /api/pl/projects/:id |
| [S-14] Summary PL | M6-02 | GET /api/pl/summary |
| [S-15] Cashflow | M6-03 | GET/PUT /api/cashflow |

---

## 共通ルール

- **エラーハンドリング**: 全 API route は try/catch で `{ error: { code, message } }` を返す
- **認可チェック**: `requireRole()` ヘルパーを `src/lib/auth.ts` で実装し、全 API route の先頭で呼ぶ
- **バリデーション**: リクエスト body は Zod で parse、失敗時は 400 `VALIDATION_ERROR`
- **audit_logs**: CREATE/UPDATE/DELETE 操作は必ず `audit_logs` に INSERT
- **論理削除**: `members`, `projects` は `deletedAt` を設定。クエリは `deletedAt: null` フィルター必須
- **PII**: `bank_*` カラムはアプリ層で AES-256 暗号化（Phase 1 は TODO コメント残し、Phase 3 で実装）
