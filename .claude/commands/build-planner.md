研修の planner 相当。目的: docs/detail-plan.md を生成し、縦切りスライス(VSA)で実装順を確定する。

参照:
- docs/sources/requirements.md
- docs/requirements/**（spec/req-v2/db/api/ipo など）

やること:
1) 対象フェーズを明示（デフォルトは Phase1）。そのフェーズのMVPを縦切りスライス 5〜12 個に分割
2) 各スライスに「目的/対象spec&req/API/DB/テスト観点/完了条件」を付与
3) 依存関係と実装順を明記
4) 最後にユーザーに「最初に実装するスライス」を必ず確認

出力:
- docs/detail-plan.md（作成/更新）

完了後:
- 次は /foundation-project-setup を案内
