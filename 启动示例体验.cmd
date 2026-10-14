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
echo Dreamscape DEMO - no paid AI calls.
echo Open http://127.0.0.1:4173 in your browser.
echo Keep this window open. Close it to stop the server.
"%DREAM_NODE%" server\demo.mjs
if errorlevel 1 echo Server failed. Read the error above.
pause
