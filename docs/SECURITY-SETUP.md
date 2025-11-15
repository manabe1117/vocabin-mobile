# 🛡️ セキュリティチェック自動化セットアップガイド

## 概要

このガイドでは、`package.json` を変更する際に自動的にセキュリティチェックが実行される環境をセットアップします。

---

## ⚠️ 重要: npm install の自動実行に関する安全対策

**Shai-Hulud マルウェア対策として、以下が実装されています：**

### 1. `.npmrc` での多層防御
```ini
ignore-scripts=true    # postinstallスクリプト自動実行を無効化
audit=true            # インストール時に脆弱性チェック
```

### 2. Cursor の自動 npm install 無効化
```json
"npm.autorun": "off"                    // 自動実行なし
"npm.enableRunFromFolder": false        // フォルダ直下での実行無効
```

### 3. Git Hooks による事前チェック
```bash
package.json 変更時 → commit 時に自動セキュリティチェック
```

**つまり、npm install がどのような経路で実行されても、以下が自動的に適用されます：**
- ✅ スクリプト自動実行なし（Shai-Hulud感染を防止）
- ✅ 脆弱性スキャン自動実行
- ✅ バージョン完全固定（package-lock.json）

---

## 📋 セットアップ手順

### ステップ 1: Git Hooks を有効化

以下のコマンドを実行してください：

```powershell
# PowerShell の場合
./scripts/setup-git-hooks.ps1

# または Bash/Git Bash の場合
bash scripts/setup-git-hooks.ps1
```

### ステップ 2: 動作確認

セットアップが完了したかを確認します：

```bash
# Git Hooks ディレクトリを確認
ls -la .git/hooks/ | grep pre-commit

# 実行結果例:
# -rwxr-xr-x  pre-commit
# -rw-r--r--  pre-commit.ps1
```

---

## 🔄 使用方法

### 新しいパッケージを追加する場合

```bash
# 1. package.json を編集
# 例: "lodash": "^4.17.21" を dependencies に追加

# 2. 変更をステージング
git add package.json

# 3. commit を試行
git commit -m "feat: add lodash package"

# 🔍 自動的にセキュリティチェックが実行されます
# ✅ チェック成功 → commit が完了
# ❌ チェック失敗 → commit が中止（修正が必要）
```

### セキュリティチェックが失敗した場合

```bash
# 詳細を確認
npm run security:check

# 問題を解決した後、再度 commit
git add package.json
git commit -m "feat: add lodash package"
```

---

## 🎯 チェック内容

Git Hooks の pre-commit フックでは以下をチェックします：

| 項目 | 説明 |
|------|------|
| **npm audit** | 依存関係の脆弱性スキャン |
| **マルウェア検査** | Shai-Hulud等の既知マルウェアの検出 |
| **ロックファイル** | package-lock.json の整合性確認 |

---

## ⚙️ 仕組み

### 1. **package.json 変更時の自動トリガー**

```
git add package.json
    ↓
git commit
    ↓
.git/hooks/pre-commit が自動実行
    ↓
npm run security:check
    ↓
✅ チェック成功 → commit 完了
❌ チェック失敗 → commit 中止
```

### 2. **実行環境の自動選択**

- **PowerShell（Windows）**: `pre-commit.ps1` が実行
- **Bash/Git Bash**: `pre-commit` が実行
- **WSL2**: `pre-commit` が実行

---

## 🔧 トラブルシューティング

### Q1: Git Hooks が実行されない

```powershell
# 実行権限を確認
icacls .git\hooks\pre-commit

# 実行権限が無い場合は付与
icacls .git\hooks\pre-commit /grant:r $env:USERNAME":F"
```

### Q2: セキュリティチェックをスキップしたい

```bash
# commit に --no-verify フラグを追加
git commit -m "message" --no-verify

# ⚠️ 注意: 緊急時のみ使用してください
```

### Q3: Pre-commit フックを無効化したい

```bash
# 無効化
mv .git/hooks/pre-commit .git/hooks/pre-commit.disabled

# 再度有効化
mv .git/hooks/pre-commit.disabled .git/hooks/pre-commit
```

---

## 📊 セキュリティチェックの実行例

```
🔍 package.json の変更を検出しました...

⚠️  package.json が変更されています
🛡️  セキュリティチェックを実行中...

npm audit results:
- No vulnerabilities found

✅ セキュリティチェックが完了しました
✅ commit を続行できます
```

---

## 🚀 追加の自動化タスク

### Cursor 内での手動実行

Cursor タスクパレット（Ctrl+Shift+B）から実行可能：

- **🔒 Security: npm Audit チェック**
- **🛡️  Security: Shai-Hulud マルウェアチェック**
- **✅ Security: 全セキュリティチェック実行**

### コマンドラインでの実行

```bash
# セキュリティチェック（詳細）
npm run security:check

# 脆弱性監査のみ
npm run security:audit
```

---

## 📝 参考資料

- [Shai-Hulud マルウェアについて](../SECURITY-CHECK.md)
- [npm audit ドキュメント](https://docs.npmjs.com/cli/v8/commands/npm-audit)
- [Git Hooks の詳細](https://git-scm.com/book/ja/v2/Git-の-内部動作-Git-Hooks)

