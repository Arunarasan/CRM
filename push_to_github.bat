@echo off
echo ===================================================
echo Initializing and Pushing CRM Project to GitHub
echo ===================================================

echo.
echo 1. Initializing Git repository...
git init

echo.
echo 2. Adding files to staging...
git add .

echo.
echo 3. Creating initial commit...
git commit -m "feat: Initial commit of CRM system (frontend and backend)"

echo.
echo 4. Setting default branch to main...
git branch -M main

echo.
echo 5. Configuring remote origin...
git remote remove origin 2>nul
git remote add origin https://github.com/Arunarasan/CRM.git

echo.
echo 6. Pushing to GitHub repository...
git push -u origin main

echo.
echo ===================================================
echo Done! Please verify on https://github.com/Arunarasan/CRM
echo ===================================================
pause
