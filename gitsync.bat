@echo off
setlocal
REM Git sync: checks, commits and pushes the changes to main.
REM Usage: .\gitsync.bat "your commit message"   (defaults to "update")
REM
REM Nothing is pushed unless "npm run check" passes: the VM builds main as it is, and a push that does not build
REM takes the app down. Files Git has never seen are listed and asked about first: "git add ." once pushed
REM helper files that held a password.

set "message=%~1"
if "%~1"=="" set "message=update"

set "branch="
for /f "delims=" %%b in ('git branch --show-current') do set "branch=%%b"
if /i not "%branch%"=="main" (
    echo You are on branch "%branch%", not on main: nothing done.
    exit /b 1
)

echo Checking for changes...
git status --porcelain | findstr /r "." >nul 2>&1
if errorlevel 1 (
    echo No changes to commit.
    exit /b 0
)

echo.
echo These changes will be committed and pushed:
git status --short
echo.

git status --porcelain | findstr /b /c:"??" >nul 2>&1
if errorlevel 1 goto check
echo The lines marked ?? are NEW files, never pushed before.
choice /C YN /M "Push the new files too"
if errorlevel 2 (
    echo Nothing done. Delete those files or list them in .gitignore, then run gitsync again.
    exit /b 1
)

:check
echo.
echo Running "npm run check": typecheck, lint, access check, examples and build. This takes a few minutes...
call npm run check
if errorlevel 1 (
    echo.
    echo The check FAILED: nothing was committed or pushed. Fix what it reports and run gitsync again.
    exit /b 1
)

echo.
echo Adding, committing and pushing...
git add . && git commit -m "%message%" && git push -u origin main
if errorlevel 1 (
    echo Something failed: read the lines above.
    exit /b 1
)
echo Done!
