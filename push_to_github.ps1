# PowerShell Script to Initialize & Push CRM project to GitHub
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "Initializing and Pushing CRM Project to GitHub" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

Write-Host "`n1. Initializing Git repository..." -ForegroundColor Yellow
git init

Write-Host "`n2. Adding all files to staging..." -ForegroundColor Yellow
git add .

Write-Host "`n3. Creating initial commit..." -ForegroundColor Yellow
git commit -m "feat: Initial commit of CRM system (frontend and backend)"

Write-Host "`n4. Renaming branch to main..." -ForegroundColor Yellow
git branch -M main

Write-Host "`n5. Configuring remote origin..." -ForegroundColor Yellow
try {
    git remote remove origin 2>$null
} catch {}
git remote add origin https://github.com/Arunarasan/CRM.git

Write-Host "`n6. Pushing to GitHub (https://github.com/Arunarasan/CRM.git)..." -ForegroundColor Yellow
git push -u origin main

Write-Host "`n===================================================" -ForegroundColor Green
Write-Host "Done! Check your repository: https://github.com/Arunarasan/CRM" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Green
