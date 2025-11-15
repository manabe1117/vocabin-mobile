# Windows用 Git Hooks 修正スクリプト

Write-Host "Tool: Git Hooks setting fix" -ForegroundColor Cyan
Write-Host ""

# 1. Git config で hooks path を設定
Write-Host "Checking Git configuration..." -ForegroundColor Yellow
$hooksPath = git config --local core.hooksPath
if ([string]::IsNullOrEmpty($hooksPath)) {
    Write-Host "  core.hooksPath not set. Setting now..." -ForegroundColor Yellow
    git config --local core.hooksPath .git/hooks
    Write-Host "  OK: core.hooksPath = .git/hooks" -ForegroundColor Green
} else {
    Write-Host "  OK: core.hooksPath = $hooksPath" -ForegroundColor Green
}

# 2. Pre-commit フック（バッチ版）の確認
Write-Host ""
Write-Host "Checking pre-commit hook..." -ForegroundColor Yellow

$preCommitBat = ".git\hooks\pre-commit.bat"
if (Test-Path $preCommitBat) {
    Write-Host "  OK: $preCommitBat exists" -ForegroundColor Green
} else {
    Write-Host "  ERROR: $preCommitBat not found" -ForegroundColor Red
}

# 3. Pre-commit フック（シェル版）の状態確認
$preCommitBash = ".git\hooks\pre-commit"
if (Test-Path $preCommitBash) {
    Write-Host "  OK: $preCommitBash exists (for Bash/WSL)" -ForegroundColor Green
} else {
    Write-Host "  WARNING: $preCommitBash not found (optional)" -ForegroundColor Yellow
}

# 4. 使用するシェルの確認
Write-Host ""
Write-Host "Git configuration:" -ForegroundColor Cyan
git config --local --list | Select-String "core.hooksPath|core.shell"

# 5. 推奨設定の提示
Write-Host ""
Write-Host "Recommended configuration:" -ForegroundColor Cyan
Write-Host "  - Windows CMD/PowerShell: use pre-commit.bat"
Write-Host "  - Git Bash/WSL: use pre-commit"
Write-Host ""

# 6. 動作確認
Write-Host "Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Edit package.json"
Write-Host "2. git add package.json"
Write-Host "3. git commit"
Write-Host "   - Pre-commit Hook will run automatically"
