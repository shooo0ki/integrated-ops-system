# Build Gates (研修互換)

- Buildは docs/requirements/** が揃ってから開始する（Design未完了なら停止）
- docs/detail-plan.md が無い状態でスライス実装に入らない（/build-planner で作る）
- スライス実装は必ずTDD（RED→GREEN→REFACTOR）を守る
- dev起動は `npm run dev` が正常に起動し、ブラウザで確認できればOK（ポート固定しない）
- 実行が必要なコマンド（npm/prisma/docker等）は、ユーザーに提示してユーザーが実行する（勝手に実行しない）
