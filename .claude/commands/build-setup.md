設計成果物 docs/requirements/** と quality ドキュメントを参照して、ローカルで確実に起動できる実装環境を整備してください。
このコマンドは「コード実装の前に」実行される想定です。

やること（順番）:
1) 現状のリポジトリ構造を確認し、必要な雛形（package.json/README/.env.example 等）の不足を列挙
2) ローカル起動手順を docs と README に書き出す
3) DBが必要なら docker-compose.yml を提案（または作成）し、起動手順を明記
4) Prisma を使う場合：prisma/schema.prisma と seed の方針を定義（まだ作らない場合も“方針”は書く）
5) 最小のサンプルデータ（テストユーザー/初期マスタ等）を定義
6) 今回追加の「利用ツール（有料サブスク等）」を DB/seed 方針に含め、PLでツール費用が計上できるようにする
7) 契約書（DocuSign連携）用のテーブル/ストレージ方針を決め、本人・管理者のみ閲覧制御を設計に反映する（seedは不要でも可）

出力（作成/更新）:
- docs/requirements/99_build/backlog.md
  - 対象フェーズのMVP縦切りチケット（5〜15個）
  - 依存関係
  - 受け入れ条件リンク（仕様/要件/DoD）
- docs/requirements/quality/local-setup.md（または README.md に追記）
  - セットアップ手順（install, env, db, migrate, seed, start）
  - よくあるエラーと対処（ポート/ENV/DB接続）
- .env.example（存在しなければ作成）
- README.md（存在しなければ作成、存在すればセットアップ節を追記）
- （必要なら）docker-compose.yml を作成

制約:
- 秘密情報は絶対にコミットしない。例示は .env.example のみ。
- 実行が必要なコマンドは「ユーザーが手で実行する前提」で提示する（勝手に走らせない）。

最後に「次は /flow-build（実装開始）」を提案してください。
