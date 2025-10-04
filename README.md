# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## ⚠️ セキュリティ対策（重要）

このプロジェクトはShai-Huludなどのnpmマルウェア対策を実施しています：

### 実施済みの対策
- ✅ 依存関係のバージョンを正確に固定（`.npmrc` + `package.json`）
- ✅ `postinstall`スクリプトの自動実行を無効化（`.npmrc`の`ignore-scripts=true`）

### 定期的に実施すべきこと

1. **認証情報のチェック（月1回推奨）**
   - GitHub Personal Access Token
   - npm Authentication Token
   - Supabaseなどのクラウドサービスのキー
   - 不審なアクティビティがないか確認

2. **セキュリティ監査**
   ```bash
   npm audit
   ```

3. **認証情報のローテーション（必要に応じて）**
   - 長期間使用しているトークンは再発行
   - 不要なトークンは削除

### 新しいパッケージをインストールする場合

```bash
# 通常通りインストール（スクリプトは自動実行されません）
npm install <package-name>

# 信頼できるパッケージでスクリプト実行が必要な場合のみ
npm install <package-name> --ignore-scripts=false
```

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
    npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
