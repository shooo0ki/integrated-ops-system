縦切りスライスを1つ実装する（TDD厳守：RED→GREEN→REFACTOR）。

前提:
- docs/detail-plan.md が存在すること

やること:
- ユーザーに実装するスライスを確認
- spec/req-v2/db/api を参照し、以下の順で実装
  Phase0 型/バリデーション
  Phase1 Repository（RED→GREEN→REFACTOR）
  Phase2 Service（RED→GREEN→REFACTOR）
  Phase3 API（RED→GREEN→REFACTOR）
  Phase4 UI（RED→GREEN→REFACTOR）
  Phase5 統合確認（手動/E2Eいずれか）

各Phaseで「変更ファイル」「対応した要件」「次TODO」を必ず出す

完了後:
- 次は /git-commit を案内
