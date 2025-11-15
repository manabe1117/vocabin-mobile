# Git Hooks セットアップスクリプト
# このスクリプトを実行して、Git Hooks を有効化してください

Write-Host "🔧 Git Hooks をセットアップ中..." -ForegroundColor Cyan
Write-Host ""

$hooksDir = ".git\hooks"
$preCommitBash = ".git\hooks\pre-commit"
$preCommitPs1 = ".git\hooks\pre-commit.ps1"

# プリコミットフックに実行権限を付与（Bash版）
if (Test-Path $preCommitBash) {
    Write-Host "✅ Bash版 pre-commit フックが見つかりました" -ForegroundColor Green
    # Windowsではbash.exeの場合、実行権限設定が異なります
    Write-Host "   Bash版フックは WSL2/Git Bash で自動的に使用されます"
}

# PowerShell版の設定確認
if (Test-Path $preCommitPs1) {
    Write-Host "✅ PowerShell版 pre-commit フックが見つかりました" -ForegroundColor Green
}

# Gitの設定を確認
Write-Host ""
Write-Host "📋 Gitの現在の設定:" -ForegroundColor Cyan
git config --local core.hooksPath

Write-Host ""
Write-Host "🎯 セットアップ完了！" -ForegroundColor Green
Write-Host ""
Write-Host "使用方法:" -ForegroundColor Yellow
Write-Host "1. package.json を編集して新しいパッケージを追加"
Write-Host "2. git add package.json で変更をステージング"
Write-Host "3. git commit を実行"
Write-Host "   → 自動的にセキュリティチェックが実行されます"
Write-Host ""
Write-Host "⚠️  注意:" -ForegroundColor Yellow
Write-Host "- PowerShell で実行している場合は PS1 版が使用されます"
Write-Host "- Git Bash を使用している場合は Bash 版が使用されます"

