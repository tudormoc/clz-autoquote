@echo off
REM Git sync script - adds, commits, and pushes changes to main branch
REM Usage: .\gitsync.bat "your commit message" (defaults to "update" if no message provided)

REM Get commit message from first argument, default to "update"
set "message=%~1"
if "%~1"=="" set "message=update"

REM Check if there are any changes to commit
echo Checking for changes...
git diff --quiet && git diff --cached --quiet
if %errorlevel% equ 0 (
    echo No changes to commit.
    exit /b 0
)

REM Stage all changes, commit, and push to main branch
echo Adding and committing...
git add . && git commit -m "%message%" && git push -u origin main

REM Report success or failure
if %errorlevel% equ 0 (echo Done!) else (echo Something failed!)