@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "DREAM_NPM=npm.cmd"
where npm.cmd >nul 2>nul
if errorlevel 1 (
 echo npm was not found. Install Node.js and add it to PATH.
 pause
 exit /b 1
)
echo Installing dependencies from the official npm registry.
call "%DREAM_NPM%" ci --registry https://registry.npmjs.org --no-audit --no-fund
if errorlevel 1 goto failed
call "%DREAM_NPM%" run build
if errorlevel 1 goto failed
echo Installation and build completed.
goto end
:failed
echo Installation or build failed. Read the error above.
:end
pause
