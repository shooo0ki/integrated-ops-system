# MEMBER_TOOL エンティティ定義

| 論理名 | 物理名 | 型 | 必須 | 制約 | 例 | 出所 | 利用先 | PII | 備考 |
|--------|--------|-----|------|------|----|------|--------|-----|------|
| ツールID | id | UUID | ○ | PK | `uuid-xxxx` | システム | — | — | |
| メンバーID | member_id | UUID | ○ | FK → MEMBER.id | — | M1-03 | M1-02 表示, M6 コスト | — | |
| ツール名 | tool_name | VARCHAR(100) | ○ | — | `Claude` | M1-03 | M1-02 | — | |
| プラン | plan | VARCHAR(50) | — | — | `Pro` | M1-03 | M1-02 | — | プルダウン選択（例: Free/Pro/Business/Max 等） |
| 月額 | monthly_cost | INTEGER | ○ | 0 以上 | `6800` | M1-03 | M6 コスト | — | 円（数値入力） |
| 請求先会社 | company_label | ENUM | ○ | `boost` / `salt2` | `boost` | M1-03 | M6 配分 | — | 初期値=所属会社。必要に応じて切替 |
| 更新ポリシー | — | — | — | — | — | — | — | — | プラン変更は既存行の plan/monthly_cost を上書き編集（履歴は audit_logs で保持）。削除→追加も可 |
| 備考 | note | VARCHAR(200) | — | — | — | M1-03 | M1-02 | — | |
| 作成日時 | created_at | TIMESTAMPTZ | ○ | DEFAULT NOW() | — | システム | — | — | |
| 更新日時 | updated_at | TIMESTAMPTZ | ○ | ON UPDATE NOW() | — | システム | — | — | |

## 利用シーン
- メンバー詳細での利用ツール表示
- プロジェクト/会社別 PL コスト（ツール費）の算定に加算
