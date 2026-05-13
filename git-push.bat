@echo off
echo ============================================
echo  YouLo - Git Setup Script
echo ============================================

cd /d D:\youlo-app

:: Remove old lock if exists
if exist .git\index.lock del /f .git\index.lock

:: Init git if not already
if not exist .git (
    git init
    echo Git initialized.
)

:: Set remote
git remote remove origin 2>nul
git remote add origin https://github.com/NgoNgoc05-tech/DNU_FIT4007_CNPM_Nhom10.git
echo Remote set.

:: Stage files (exclude node_modules and uploads)
git add .gitignore
git add README.md
git add server.js
git add package.json
git add frontend/package.json
git add frontend/public/index.html
git add frontend/src/

echo Files staged.

:: Commit
git commit -m "feat: YouLo app - dark Gen Z UI, fixed bidirectional WebRTC call"

:: Push
git branch -M main
git push -u origin main

echo ============================================
echo  Done! Check: https://github.com/NgoNgoc05-tech/DNU_FIT4007_CNPM_Nhom10
echo ============================================
pause
