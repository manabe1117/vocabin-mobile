#!/usr/bin/env node

/**
 * Google Play用のビルドとアップロードを自動化するスクリプト
 * 
 * 使用方法:
 * node scripts/build-for-google-play.js [--build] [--submit] [--track internal|alpha|beta|production]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 設定
const CONFIG = {
  projectId: 'de364276-098c-4e49-9ec7-5db36ed895d5',
  serviceAccountKeyPath: './play-store-service-account.json',
  defaultTrack: 'internal'
};

// コマンドライン引数の解析
const args = process.argv.slice(2);
const shouldBuild = args.includes('--build');
const shouldSubmit = args.includes('--submit');
const trackIndex = args.findIndex(arg => arg === '--track');
const track = trackIndex !== -1 ? args[trackIndex + 1] : CONFIG.defaultTrack;

console.log('🚀 Vocabin Google Play ビルドスクリプト');
console.log('=====================================');
console.log(`プロジェクトID: ${CONFIG.projectId}`);
console.log(`トラック: ${track}`);
console.log(`ビルド: ${shouldBuild ? 'はい' : 'いいえ'}`);
console.log(`アップロード: ${shouldSubmit ? 'はい' : 'いいえ'}`);
console.log('');

// 前提条件のチェック
function checkPrerequisites() {
  console.log('📋 前提条件のチェック...');
  
  // EAS CLIの確認
  try {
    execSync('eas --version', { stdio: 'pipe' });
    console.log('✅ EAS CLI がインストールされています');
  } catch (error) {
    console.error('❌ EAS CLI がインストールされていません');
    console.error('npm install -g @expo/eas-cli を実行してください');
    process.exit(1);
  }
  
  // ログイン状態の確認
  try {
    execSync('eas whoami', { stdio: 'pipe' });
    console.log('✅ EAS にログインしています');
  } catch (error) {
    console.error('❌ EAS にログインしていません');
    console.error('eas login を実行してください');
    process.exit(1);
  }
  
  // サービスアカウントキーの確認
  if (shouldSubmit && !fs.existsSync(CONFIG.serviceAccountKeyPath)) {
    console.error('❌ Google Play サービスアカウントキーが見つかりません');
    console.error(`パス: ${CONFIG.serviceAccountKeyPath}`);
    console.error('Google Play Console からダウンロードしてください');
    process.exit(1);
  }
  
  console.log('✅ 前提条件を満たしています\n');
}

// ビルドの実行
async function buildApp() {
  if (!shouldBuild) {
    console.log('⏭️  ビルドをスキップします');
    return;
  }
  
  console.log('🔨 アプリのビルドを開始...');
  
  try {
    console.log('📱 本番用ビルドを実行中...');
    execSync(`eas build --platform android --profile production --non-interactive`, {
      stdio: 'inherit'
    });
    console.log('✅ ビルドが完了しました\n');
  } catch (error) {
    console.error('❌ ビルドに失敗しました');
    console.error(error.message);
    process.exit(1);
  }
}

// アプリのアップロード
async function submitApp() {
  if (!shouldSubmit) {
    console.log('⏭️  アップロードをスキップします');
    return;
  }
  
  console.log('📤 Google Play へのアップロードを開始...');
  
  try {
    console.log(`🚀 ${track} トラックにアップロード中...`);
    execSync(`eas submit --platform android --latest --track ${track} --non-interactive`, {
      stdio: 'inherit'
    });
    console.log('✅ アップロードが完了しました\n');
  } catch (error) {
    console.error('❌ アップロードに失敗しました');
    console.error(error.message);
    process.exit(1);
  }
}

// メイン処理
async function main() {
  try {
    checkPrerequisites();
    await buildApp();
    await submitApp();
    
    console.log('🎉 すべての処理が完了しました！');
    console.log('');
    console.log('次のステップ:');
    console.log('1. Google Play Console でアプリの審査状況を確認');
    console.log('2. 必要に応じてスクリーンショットや説明文を更新');
    console.log('3. 審査完了後、公開設定を行う');
    
  } catch (error) {
    console.error('❌ エラーが発生しました');
    console.error(error.message);
    process.exit(1);
  }
}

// ヘルプの表示
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
使用方法:
  node scripts/build-for-google-play.js [オプション]

オプション:
  --build                   アプリをビルドする
  --submit                  ビルドしたアプリをGoogle Playにアップロードする
  --track <track>           アップロード先のトラック (internal|alpha|beta|production)
  --help, -h                このヘルプを表示

例:
  # ビルドのみ実行
  node scripts/build-for-google-play.js --build
  
  # ビルドして内部テストトラックにアップロード
  node scripts/build-for-google-play.js --build --submit --track internal
  
  # 本番トラックにアップロード
  node scripts/build-for-google-play.js --build --submit --track production
`);
  process.exit(0);
}

// スクリプトの実行
main();
