docs/requirements/requirements-v2/*.md と docs/requirements/database/database-design.md を参照し、API設計書を作成してください。
不足情報があれば最大5問だけ質問してください。

出力（作成/更新）:
- docs/requirements/api/api-design.md

含める内容:
- 認証/認可（想定でOKだが一貫性を保つ）
- エンドポイント一覧（method/path）
- 各APIの Request/Response（例）
- エラー設計（共通エラー、validation、権限、404等）
- ページ↔API対応表
- 監査ログ/トレーシング方針（必要なら）

最後に「Design完了」と案内し、次に /flow-build を提案してください。
