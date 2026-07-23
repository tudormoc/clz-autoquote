# CLZ AutoQuote — Update & Redeploy Script
# Run this on the VM whenever you push new changes from your laptop.
# Usage: .\update.ps1

Write-Host "`n[1/4] Pulling latest changes from Git..." -ForegroundColor Cyan
git pull

Write-Host "`n[2/4] Installing dependencies (new packages)..." -ForegroundColor Cyan
npm install

Write-Host "`n[3/4] Building production bundle..." -ForegroundColor Cyan
npm run build

Write-Host "`n[4/4] Restarting PM2 processes..." -ForegroundColor Cyan
pm2 restart ecosystem.config.js --update-env
pm2 save

Write-Host "`n✅ Done! App updated and running." -ForegroundColor Green
pm2 list
