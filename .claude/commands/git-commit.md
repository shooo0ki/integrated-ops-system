品質ゲートを通して commit/push する（実行はユーザー）。

推奨順:
- npm run format（または prettier）
- npm run lint
- npm run typecheck
- npm test（存在すれば）
- git add -A
- git commit -m "<提案メッセージ>"
- git push

出力:
- 実行コマンド一覧
- コミットメッセージ案（1〜3）
- 失敗時の対処（代表例）
