docs/requirements/** と src/** を照合し、「要件 ↔ 実装」の対応表と未実装項目（ギャップ）を作成してください。
実装が無い場合は、design docs だけから「実装チェックリスト」を作成してください。

出力（作成/更新）:
- docs/review/gap-analysis.md
  - 画面（specifications/{page}.md）ごとの実装状況（実装ファイル/未実装/部分実装）
  - API（api-design.md）ごとの実装状況（ルート/ハンドラ/未実装）
  - DB（database-design.md）ごとの実装状況（schema/migration/未実装）
  - DoD（definition-of-done.md）の達成状況（未達項目）
  - 次のアクション（優先度付き）

ルール:
- “どのファイルが根拠か” を必ず書く（例：src/app/...、src/lib/...）
- 未実装は具体的に「何を作るべきか」まで落とす

最後に「次にやるべきチケットTop5」を提示してください。
