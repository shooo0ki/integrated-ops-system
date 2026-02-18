# 統合業務管理システム 開発Runbook（Design → Build → Review）

このドキュメントは、本プロジェクトを「研修の進め方」に寄せて、Claude Code とスラッシュコマンドで確実に前進させるための実行手順書です。  
“何を・どの順で”実行するかだけに絞っています。

---

## 0. 前提（入力ソース）
- 原本: `docs/sources/requirements.docx`
- LLM参照用: `docs/sources/requirements.md`（こちらを主に参照）
- 設計成果物: `docs/requirements/**`
- 実装コード: `src/**`
- レビュー成果物: `docs/review/**`

---

## 1. 全体フェーズ概要

### Phase A: Design（設計）
目的:
- 要件から設計成果物（10点セット）を作り、実装の手戻りを防ぐ
成果物:
- `docs/requirements/**` が埋まる（business/persona/journey/spec/req/ipo/data/db/reqv2/api）

### Phase B: Quality & Setup（品質・環境準備）
目的:
- 初心者が詰まりやすい「完了条件」「ローカル起動」「作業チケット」を固める
成果物:
- DoD / ガイドライン / ローカル手順 / backlog が揃う

### Phase C: Preflight（開発前総合チェック）
目的:
- “いま実装してOKか”を機械的に判定する（READY/NOT READY）

### Phase D: Build（実装）
目的:
- 研修順（planner → foundation → slice → commit）で縦切り実装を進める
成果物:
- `src/**` が増える
- `docs/detail-plan.md`（実装計画）が存在する

### Phase E: Review（理解深化）
目的:
- 実装を解析し、俯瞰・詳細・理解チェックのドキュメントを生成する
成果物:
- `docs/review/step-*.md`

### Phase F: Gap（設計と実装の差分確認）
目的:
- 未実装/ズレ/追加を可視化し、次のチケットへ落とす
成果物:
- `docs/review/gap-summary.md`

---

## 2. コマンド実行順（推奨Run）

### Phase A: Design（設計10ステップ）
1. `/flow-design`
2. `/design-business`
3. `/design-persona`
4. `/design-journey`
5. `/design-spec`

#### 認証仕様を明示したい場合（推奨）
- `/design-auth`
  - ログイン画面に「Sign in with Slack」「Sign in with Google」を明記し、NextAuth前提を固める

6. `/design-requirements`
7. `/design-ipo`
8. `/design-data`
9. `/design-db`
10. `/design-requirements-v2`
11. `/design-api`

完了条件:
- `docs/requirements/` 配下に必要なディレクトリと md が揃っている
- 特に `docs/requirements/database/database-design.md` と `docs/requirements/api/api-design.md` が存在すること

---

### Phase B: Quality & Setup（品質・環境準備）
Design完了後に実行:

1. `/design-quality`
   - DoD / Engineering Guidelines / Local Setup / Backlog を作る
2. `/build-setup`
   - README / .env.example / DB起動手順 / seed方針の“準備”を整える
3. （必要に応じて）`/build-check`
   - lint/typecheck/test の品質ゲート整備

完了条件:
- `docs/requirements/quality/definition-of-done.md` が存在
- `docs/requirements/quality/local-setup.md` または README にローカル起動が書かれている
- `docs/requirements/99_build/backlog.md` が存在

---

### Phase C: Preflight（開発前総合チェック）
1. `/preflight`

完了条件:
- 結果が `READY` になること  
- `NOT READY` の場合は不足項目を埋めて再実行

---

### Phase D: Build（研修順の実装）
実装は必ず研修順で行う。

1. `/flow-build`（司令塔）
   - 内部で次を促す（研修順固定）

2. `/build-planner`
   - `docs/detail-plan.md` を作成し、縦切りスライスと順序を確定

3. Foundation（基盤）
   - `/foundation-project-setup`
   - `/foundation-database-setup`
   - `/foundation-migration-seeder`

4. スライス実装（繰り返し）
   - `/fullstack-integration`（スライスを1つ縦切り実装）
   - `/git-commit`（品質ゲート → commit/push）

完了条件（MVP）:
- MVPスコープ（Phase 1）の主要スライスが完了している
- `src/**` が動作し、ローカルで確認できる
- 主要な lint/typecheck/test が通る（DoD準拠）

---

### Phase E: Review（理解深化）
1. `/flow-review`

完了条件:
- `docs/review/step-1_overview.md` 〜 が生成されている

---

### Phase F: Gap（差分確認）
1. `/review-gap`

完了条件:
- `docs/review/gap-summary.md` が生成され、未実装・ズレが整理されている

---

## 3. Git運用（推奨）
フェーズごとにコミットする（研修と同じ粒度）。

- Design完了後:
  - `git add docs/requirements/`
  - `git commit -m "design: complete requirements documents"`
  - `git push`

- Quality/Setup完了後:
  - `git add docs/requirements/quality docs/requirements/99_build README.md .env.example docker-compose.yml 2>/dev/null || true`
  - `git commit -m "chore: add quality gates and local setup"`
  - `git push`

- Build（スライス1つ完了ごと）:
  - `git add -A`
  - `git commit -m "feat: implement <slice name>"`
  - `git push`

- Review完了後:
  - `git add docs/review/`
  - `git commit -m "docs: add review artifacts"`
  - `git push`

---

## 4. 迷ったら
- “設計が空”なら: Designへ戻る（/flow-design）
- “detail-plan が無い”なら: /build-planner
- “動かない”なら: local-setup / build-setup を見直す
- “どこまでやれば完了か”は: definition-of-done を参照
