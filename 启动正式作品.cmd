@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "DREAM_NODE=node"
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js was not found. Install Node.js and add it to PATH.
 pause
 exit /b 1
)
"%DREAM_NODE%" --version >nul 2>nul
if errorlevel 1 (
 echo Node.js was not found. Install Node.js or add it to PATH.
 pause
 exit /b 1
)
if not exist "node_modules\express" (
 echo Dependencies are missing. Run the dependency installation CMD first.
 pause
 exit /b 1
)
if not exist ".env" copy ".env.example" ".env" >nul
echo Dreamscape - MySQL server mode.
echo Fill DB credentials in .env and initialize the database first.
echo AI keys are optional until you use the corresponding AI feature.
echo Open http://127.0.0.1:4173 in your browser.
set "DEMO_MODE=false"
"%DREAM_NODE%" server\index.mjs
if errorlevel 1 echo Server failed. Read the error above.
pause
