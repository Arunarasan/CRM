Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Pushing CRM changes to GitHub" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
git add .
git commit -m "fix(db): add production Flyway V1 baseline migration and reset script"
git push origin main
Write-Host "==========================================" -ForegroundColor Green
Write-Host "Done! Render will trigger a new deployment." -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
