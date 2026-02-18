docs/sources/requirements.docx と docs/requirements/** を参照して、初心者でも品質を落とさず実装できるように「完了条件（DoD）」と「実装ガイドライン」を作成してください。
不足があれば最大5問まで質問してください（特に：技術スタック、認証の有無、対象環境、必須の品質基準）。

出力（作成/更新）:
1) docs/requirements/quality/definition-of-done.md
- ページ共通DoD（UI/UX/入力バリデーション/エラー/権限/アクセシビリティ/ログ）
- API共通DoD（認可/validation/エラー形式/監査ログ）
- DB共通DoD（migration/整合性/seed/監査列）
- テスト最低ライン（最小でOK、ただし明示）
- リリース準備（env/秘密情報/設定）

2) docs/requirements/quality/engineering-guidelines.md
- 採用スタックの固定（例：Next.js App Router, TS, Tailwind/shadcn, Prisma, Postgres）
- ディレクトリ規約（src/app, src/components, src/lib, prisma 等）
- 命名規約（ファイル/コンポーネント/API/DB）
- 実装方針（状態管理、フォーム、エラーハンドリング、API層、ログ）
- セキュリティ最小要件（認証/認可、入力検証、PII）
- コーディングスタイル（lint/format、型、関数の責務）

最後に「次は /design-api（未実施なら）→ /flow-build、または /build-setup」を提案してください。
