# Shai-Huludマルウェア感染チェックリスト

## 🚨 現在の環境が感染していないか確認

### 1. 認証情報の確認

#### GitHub
- https://github.com/settings/tokens にアクセス
- 見覚えのないトークンがないか確認
- 不審なトークンがあれば即座に削除

#### npm
- https://www.npmjs.com/settings/tokens にアクセス
- 見覚えのないトークンがないか確認
- 不審なトークンがあれば即座に削除（Revoke）

#### クラウドサービス（Supabase等）
- 各サービスのAPIキー管理画面で不審なキーがないか確認
- アクセスログを確認

### 2. GitHubリポジトリの確認

```bash
# 最近のコミット履歴を確認
git log --all --oneline -20

# 不審なコミットがないか確認（特にpackage.jsonの変更）
git log --all --oneline -- package.json
```

- 身に覚えのないコミットがないか確認
- 特に`package.json`に不審なパッケージが追加されていないか確認

### 3. ローカル環境の確認

#### Windowsの場合
```powershell
# ホームディレクトリの.npmrcを確認
Get-Content "$env:USERPROFILE\.npmrc"

# グローバルにインストールされたパッケージを確認
npm list -g --depth=0
```

#### 不審なグローバルパッケージがある場合
```bash
npm uninstall -g <package-name>
```

### 4. プロジェクトの依存関係の確認

```bash
# 依存関係の監査
npm audit

# package-lock.jsonの整合性確認
npm ci
```

## ✅ 感染が疑われる場合の対応

1. **即座に全ての認証情報を再発行**
   - GitHub: https://github.com/settings/tokens
   - npm: https://www.npmjs.com/settings/tokens
   - Supabase: プロジェクト設定 → API
   - その他使用中のクラウドサービス

2. **環境変数とシークレットの更新**
   - `.env`ファイル内のキーを全て再発行
   - CI/CDの環境変数を更新
   - Gitの履歴に認証情報がないか確認

3. **チームメンバーへの通知**
   - 感染の可能性をチームに共有
   - 全員が認証情報をチェック

4. **専門家への相談**
   - 重大な被害が疑われる場合は、セキュリティ専門家に相談

## 📝 予防的措置（実施済み）

このプロジェクトでは以下の対策を実施しています：

- ✅ `.npmrc`で`ignore-scripts=true`を設定
- ✅ 依存関係のバージョンを固定
- ✅ `package-lock.json`を必須化

## 参考資料

- [Sysdig: Shai-Hulud解説](https://sysdig.jp/blog/shai-hulud-the-novel-self-replicating-worm-infecting-hundreds-of-npm-packages/)
- [OPSWAT: サプライチェーンリスクの再定義](https://japanese.opswat.com/blog/from-dune-to-npm-shai-hulud-worm-redefines-supply-chain-risk)


