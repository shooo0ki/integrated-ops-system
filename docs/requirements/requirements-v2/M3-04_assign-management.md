# M3-04 アサイン管理 — 要件定義 v2（確定版）

> 作成日: 2026-02-20 | v1 → v2 更新

---

## v1 からの変更点

| 区分 | 内容 |
|------|------|
| データ要件 | テーブル名・カラム名を物理名に統一。スキル充足判定 SQL を明記 |
| 非機能要件 | 確定値に更新 |
| 運用要件 | セクション新設 |

---

## 機能要件（確定）

| 優先度 | 要件 |
|--------|------|
| Must | PJ のポジションを選択し、メンバーをアサイン登録できる（期間・月間想定工数を入力） |
| Must | 既存アサインを解除（`end_date` を設定）できる |
| Must | 同一 PJ・同一ポジションへの重複アサインを拒否する |
| Must | 月間工数が 0 以下の場合はバリデーションエラーを表示する |
| Must | メンバー候補テーブルにスキル充足状況（✅充足 / ⚠️不足）と現在の月間工数合計を表示する |
| Must | 対象ポジションの必要スキル（項目＋必要レベル）を画面上部に表示する |
| Must | スキルフィルタートグルで要件充足メンバーのみ / 全員 を切り替えられる（デフォルト=OFF=全員表示） |
| Must | ポジション選択時に初期ポジション一覧の説明・責任範囲を表示する（PM/担当リーダー/メイン・ジュニアエンジニア/メイン・ジュニアDS/メイン営業/営業アシスタント） |
| Must | 管理者は全 PJ のアサイン管理ができる |
| Must | マネージャーは担当 PJ のみアサイン管理できる |
| Must | 社員・インターンはアクセス不可（403） |
| Should | ポジションタブで切り替えて各ポジションのアサイン状況を表示する |

---

## データ要件（確定）

| テーブル | カラム | 制約 |
|---------|--------|------|
| `project_assignments` | `id`, `project_id`, `member_id`, `position_id`, `workload_hours`, `start_date`, `end_date`, `created_by` | `workload_hours`: 1 以上 |
| `project_positions` | `id`, `project_id`, `position_name` | ポジション一覧 |
| `position_required_skills` | `position_id`, `skill_id`, `min_level` | 必要スキル要件 |
| `member_skills` | `member_id`, `skill_id`, `level`, `evaluated_at` | スキル充足判定（最新評価）|
| `members` | `id`, `name` | 候補テーブル |

**スキル充足判定ロジック（確定）:**
```sql
-- 対象ポジションの全スキル要件を取得
SELECT prs.skill_id, prs.min_level,
       ms.level AS current_level,
       CASE WHEN ms.level >= prs.min_level THEN true ELSE false END AS is_satisfied
FROM position_required_skills prs
LEFT JOIN (
  SELECT DISTINCT ON (member_id, skill_id) member_id, skill_id, level
  FROM member_skills
  WHERE member_id = :memberId
  ORDER BY member_id, skill_id, evaluated_at DESC
) ms ON ms.skill_id = prs.skill_id
WHERE prs.position_id = :positionId
```

全スキルが充足 → ✅ / 1 つでも不足 → ⚠️（不足スキルとレベル差を表示）

**現在の月間工数合計:**
```sql
SELECT SUM(workload_hours) FROM project_assignments
WHERE member_id = :memberId AND (end_date IS NULL OR end_date >= CURRENT_DATE)
```

---

## 非機能要件（確定）

| 区分 | 内容 |
|------|------|
| 性能 | アサイン登録 API 応答 200ms 以内 |
| セキュリティ | 認証必須。マネージャーの担当外 PJ 操作はサーバー側で拒否 |
| 監査 | アサイン登録・解除を `audit_logs` に記録（action = 'CREATE'/'UPDATE'、対象メンバー・ポジション・工数） |
| ログ | 重複アサイン検出・DB エラーをサーバーログに記録 |
| 可用性 | アサイン登録は楽観的 UI は使用せず、保存完了後に画面を更新する |

---

## 運用要件

| 項目 | 内容 |
|------|------|
| バックアップ | `project_assignments` は日次バックアップ対象 |
| データ保持 | アサイン解除は `end_date` 設定（論理削除）。削除は行わない |

---

## 受け入れ条件（確定）

- [ ] 管理者がメンバー・ポジション・工数・開始日を入力してアサインを登録できる
- [ ] 同一 PJ・同一ポジションへの重複アサインで「このメンバーはすでにこのポジションにアサイン済みです」が表示される
- [ ] 月間工数 0 を入力すると「工数は 1 時間以上を入力してください」が表示される
- [ ] スキルフィルター ON で要件充足メンバーのみ候補に表示される
- [ ] メンバー候補テーブルにスキル充足（✅）/ 不足（⚠️）が表示される
- [ ] 既存アサインの「解除」で `end_date` が設定されてアサインが終了する
- [ ] マネージャーが担当外 PJ のアサイン管理にアクセスすると 403 が返る
- [ ] `audit_logs` にアサイン登録のレコードが追加されている
