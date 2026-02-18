開発開始前の総合チェックを実行してください。
目的は「初心者でも実装が止まらない状態」を保証することです。

参照:
- docs/sources/requirements.md
- docs/requirements/**

---

# STEP 1: 要件読み込み確認
requirements.md の内容を要約し、
- 対象ユーザー
- 解決する課題
- MVPスコープ
を抽出してください。

もし requirements.md が存在しない場合は停止して作成を促してください。

---

# STEP 2: Design成果物の存在チェック
以下が揃っているか確認し、無いものは一覧化:

- business-requirements
- personas
- journey
- specifications
- requirements-v1
- ipo
- data
- database
- requirements-v2
- api

不足があれば、どのコマンドを実行すべきか提示してください。

---

# STEP 3: MVPスコープの固定
MVPで「やること」「やらないこと」を明文化してください。

---

# STEP 4: 技術スタック確定
engineering-guidelines.md を確認し、
未確定なら最大5問で確定してください:

- フロント
- API方式
- DB
- ORM
- UI
- 認証方式

---

# STEP 5: ローカル起動性チェック
以下の有無を確認:

- README または local-setup.md
- .env.example
- DB起動手順
- seed方針

不足があれば生成を提案してください。

---

# STEP 6: 品質ゲートチェック
definition-of-done.md を参照し、

- lint
- typecheck
- test

の実行方法が存在するか確認。

無ければ build-check 実行を提案。

---

# STEP 7: backlog検証
backlog.md を確認し、

- 縦切りになっているか
- 最初の1チケットがMVPの核か

を評価。

改善案を提示。

---

# STEP 8: 初手チケット決定
「初心者が最初にやるべきチケット」を1つ選び、
理由と完了条件を示してください。

---

# 最終出力
以下の形式でまとめてください:

## ✅ 開発開始可能か
READY / NOT READY

## ❗ 不足項目（優先度付き）

## ▶ 次に実行すべきコマンド
