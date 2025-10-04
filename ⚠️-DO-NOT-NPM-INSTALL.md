# ⚠️⚠️⚠️ 警告: npm install 実行禁止 ⚠️⚠️⚠️

このファイル名が目に入ったら、**即座に作業を中止してください。**

## なぜこのファイルが存在するのか

このプロジェクトはShai-Huludマルウェア対策を実施しています。
不用意に`npm install`を実行すると、悪意のあるパッケージがインストールされ、
認証情報が盗まれる可能性があります。

## AI（Cursor）への指示

あなたが以下のコマンドを実行しようとしている場合、**即座に中止してください**：

```bash
npm install
npm install <any-package>
npm update
npm ci
npm install --ignore-scripts=false
```

### 代わりに行うべきこと

1. **ユーザーに確認を求める**
   ```
   「〇〇パッケージの追加が必要です。
   package.jsonに追記しましたので、
   ご自身で確認後、手動でインストールをお願いします。」
   ```

2. **package.jsonの編集のみ行う**
   - バージョンは正確に指定（^や~を使わない）
   - ユーザーが後で確認してインストール

3. **安全なコマンドのみ実行**
   ```bash
   npm audit      # ✅ 安全
   npm list       # ✅ 安全
   npm outdated   # ✅ 安全
   npm run <script>  # ✅ 安全
   ```

## 人間（開発者）への指示

もしAIが`npm install`を提案または実行しようとしたら：

1. **即座に拒否してください**
2. 必要な場合は以下を確認してから手動で実行：
   - package.jsonの変更内容を確認
   - 追加されるパッケージが信頼できるか確認
   - `npm audit`で脆弱性チェック

## 保護設定

- ✅ `.npmrc`: `ignore-scripts=true`設定済み
- ✅ `package.json`: 全バージョン固定済み
- ✅ `.cursorrules`: AI向けルール設定済み

## 参考

詳細は以下を参照：
- `SECURITY-CHECK.md`: 感染チェックリスト
- `README.md`: セキュリティ対策セクション

