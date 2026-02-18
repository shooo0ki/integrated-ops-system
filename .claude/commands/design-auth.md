ログイン仕様に OAuth（Slack / Google）を採用する設計を追加してください。

対象:
- docs/requirements/specifications/login.md（存在しなければ新規作成）
- docs/requirements/requirements-v2/authentication.md（存在しなければ新規作成）
- docs/requirements/database/database-design.md（認証の将来拡張性を保証）

参照:
- docs/sources/requirements.md
- 既存の設計ドキュメント

---

# 仕様（Spec）に追加する内容

ログイン画面のUI要件として以下を定義:

- 「Sign in with Slack」ボタンを表示
- 「Sign in with Google」ボタンを表示
- メール/パスワード認証は Phase 1 では提供しない

認証方式:

- NextAuth.js を使用
- OAuthプロバイダは将来的に追加可能な構成とする

ログインフロー:

1. ユーザーがプロバイダを選択
2. OAuth認証
3. 初回ログイン時にUserを自動作成
4. ダッシュボードへリダイレクト

エラーケース:

- 認証失敗時はログイン画面に戻る
- 権限未付与ユーザーはアクセス拒否

---

# 機能要件（requirements-v2）に追加

FR-AUTH-01: ユーザーは Slack または Google アカウントでログインできる  
FR-AUTH-02: 初回ログイン時にユーザーを自動作成する  
FR-AUTH-03: 同一メールアドレスは同一ユーザーとして扱う  
FR-AUTH-04: 認証プロバイダは追加可能とする  

---

# DB設計の制約

- 業務テーブルは userId のみを参照する
- provider に依存しない
- NextAuth標準の User / Account / Session 構成を採用する

---

# 出力

- login.md を作成/更新
- authentication.md を作成/更新
- database-design.md に認証方針を追記

完了後に以下を表示:

「認証仕様の設計が完了しました」
