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
if not exist ".env" (
 copy ".env.example" ".env" >nul
 echo Created .env. Fill your DB credentials, then run this CMD again.
 pause
 exit /b 1
)
echo Creating the project database and five tables. Existing databases are kept.
"%DREAM_NODE%" server\init-db.mjs
if errorlevel 1 (
 echo Database setup failed. Check DB credentials and the MySQL service.
) else (
 echo Database setup completed successfully.
)
pause
