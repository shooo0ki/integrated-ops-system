このプロジェクトの品質ゲート（lint/typecheck/test/CI）を整備してください。
現状のスタックを確認し、不足があれば最大5問だけ質問してください（例：npm or pnpm、テスト方針、Nodeバージョン）。

出力（作成/更新）:
1) docs/requirements/quality/quality-gates.md
- 必須コマンド（例：lint, typecheck, test）
- 失敗時の対応
- PR前チェックリスト

2) .github/workflows/ci.yml（存在しなければ作成）
- checkout
- Nodeセットアップ
- install
- lint
- typecheck
- test（テストが無ければ “placeholder” として後で追加する前提でTODOを明記）

3) package.json scripts の推奨（既にあれば差分提案）
- "lint"
- "typecheck"
- "test"
- "format"（任意）

注意:
- 既存の構成を壊さない（既存スクリプトがある場合はそれを優先）
- 初心者が実行できるように、READMEまたは local-setup.md に「実行順」を追記する

最後に「次は /flow-build または /flow-review」を提案してください。
