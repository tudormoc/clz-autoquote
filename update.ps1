# CLZ TM - update and redeploy. Run on the VM after a push:  .\update.ps1
#
# Every step is checked. When one fails the script stops there and says so in red, and PM2 is restarted only on a
# build that finished. Before building, the build in use is copied to a folder next to this one; when the new build
# fails, that copy is put back together with the code and the packages it was made from, so the app keeps running
# the version it had.
# Plain ASCII on purpose: Windows PowerShell 5 reads a file without a BOM in the machine's own code page.

Set-Location $PSScriptRoot
$lastBuild = Join-Path (Split-Path -Parent $PSScriptRoot) 'clz-autoquote-last-build'

function Step([string]$text) { Write-Host "`n$text" -ForegroundColor Cyan }

function Fail([string]$what, [string]$state) {
    Write-Host "`n[FAILED] $what" -ForegroundColor Red
    Write-Host $state -ForegroundColor Yellow
    exit 1
}

# robocopy answers 0 to 7 when it copied (or had nothing to copy), 8 and above when something went wrong.
# The bundler's cache and the dev folder are left out: they are not part of a build.
function Copy-Build([string]$from, [string]$to) {
    robocopy $from $to /MIR /XD cache dev /NFL /NDL /NJH /NJS /NP | Out-Null
    return ($LASTEXITCODE -lt 8)
}

$before = git rev-parse HEAD
if ($LASTEXITCODE -ne 0) { Fail 'This folder is not a git checkout.' 'Nothing was changed.' }

Step "[1/5] Pulling the latest changes from Git (now at $($before.Substring(0, 7)))..."
git checkout -- package-lock.json 2>$null
git pull
if ($LASTEXITCODE -ne 0) {
    Fail 'git pull' 'Nothing was changed: the app runs the version it had. Check the network and run .\update.ps1 again.'
}

Step '[2/5] Installing the packages...'
npm install
if ($LASTEXITCODE -ne 0) {
    git reset --hard $before | Out-Null
    Fail 'npm install' 'The code is back at the version before the pull and the build was not touched: the app runs the version it had. PM2 was not restarted. Check the internet connection and run .\update.ps1 again.'
}

Step '[3/5] Keeping the build in use, in case the new one fails...'
$kept = $false
if (Test-Path '.next\BUILD_ID') { $kept = Copy-Build '.next' $lastBuild }
if (-not $kept) { Write-Host 'There is no finished build to keep (a first build, or the copy failed): a failed build could not be put back.' -ForegroundColor Yellow }

Step '[4/5] Building...'
npm run build
if ($LASTEXITCODE -ne 0) {
    $state = 'The build folder is incomplete, so the app may show errors until a build succeeds. PM2 was not restarted. Fix the problem on the development PC, push, and run .\update.ps1 again.'
    if ($kept) {
        git reset --hard $before | Out-Null
        npm install | Out-Null
        $packagesBack = ($LASTEXITCODE -eq 0)
        if (Copy-Build $lastBuild '.next') {
            $state = 'The build, the code and the packages of the version before were put back: the app keeps running the version it had. PM2 was not restarted. Fix the problem on the development PC, push, and run .\update.ps1 again.'
            if (-not $packagesBack) {
                $state = 'The build and the code of the version before were put back, but its packages could not be reinstalled (no internet?). The app keeps running; PM2 was not restarted. Run .\update.ps1 again once the problem is fixed and pushed.'
            }
        }
    }
    Fail 'npm run build' $state
}

Step '[5/5] Restarting PM2...'
pm2 restart ecosystem.config.js --update-env
if ($LASTEXITCODE -ne 0) {
    Fail 'pm2 restart' 'The new build is ready but the app was not restarted. Run by hand:  pm2 restart ecosystem.config.js --update-env'
}
pm2 save

Write-Host "`n[OK] Done: the app is updated and running." -ForegroundColor Green
pm2 list
