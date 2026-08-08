@echo off
echo ==========================================
echo Pushing CRM changes to GitHub
echo ==========================================
git add .
git commit -m "fix(db): add production Flyway V1 baseline migration and reset script"
git push origin main
echo ==========================================
echo Done! Render will trigger a new deployment.
echo ==========================================
