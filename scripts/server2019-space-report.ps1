# READ-ONLY disk space report for SERVER2019. Deletes/moves/modifies NOTHING.
# Run in an elevated PowerShell ON the server (RDP). Output: C:\space-report.txt (small text file).
$out = 'C:\space-report.txt'
function Log($t){ $t | Out-File $out -Append -Encoding utf8; $t }
Remove-Item $out -ErrorAction SilentlyContinue

Log "== Volumes =="
Get-Volume | ? DriveLetter | % { Log ("{0}: {1:N1} GB free of {2:N1} GB" -f $_.DriveLetter, ($_.SizeRemaining/1GB), ($_.Size/1GB)) }

function TopDirs($path,$n=15){
  if(-not (Test-Path $path)){ return }
  Log "`n== Top $n in $path =="
  Get-ChildItem $path -Force -ErrorAction SilentlyContinue | % {
    $s = if($_.PSIsContainer){ (Get-ChildItem $_.FullName -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum } else { $_.Length }
    [pscustomobject]@{GB=[math]::Round($s/1GB,2); Name=$_.FullName}
  } | Sort GB -Desc | Select -First $n | % { Log ("{0,8} GB  {1}" -f $_.GB, $_.Name) }
}
foreach($d in (Get-Volume | ? {$_.DriveLetter -and $_.DriveType -eq 'Fixed'})){ TopDirs "$($d.DriveLetter):\" 20 }

Log "`n== Known cleanup candidates (size only) =="
$cand = 'C:\Windows\Temp','C:\Windows\SoftwareDistribution\Download','C:\Windows\Logs\CBS','C:\Windows\WinSxS\Backup','C:\ProgramData\Microsoft\Windows\WER','C:\inetpub\logs','C:\Windows\System32\LogFiles','C:\Windows\Installer\$PatchCache$','C:\$Recycle.Bin','C:\Windows.old'
$cand += (Get-ChildItem 'C:\Users' -Directory -ErrorAction SilentlyContinue | % { "$($_.FullName)\AppData\Local\Temp"; "$($_.FullName)\Downloads" })
foreach($p in $cand){ if(Test-Path $p -ErrorAction SilentlyContinue){ $s=(Get-ChildItem $p -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum; Log ("{0,8:N2} GB  {1}" -f ($s/1GB),$p) } }

Log "`n== Largest 30 files (>200 MB) on fixed drives =="
foreach($d in (Get-Volume | ? {$_.DriveLetter -and $_.DriveType -eq 'Fixed'})){
  Get-ChildItem "$($d.DriveLetter):\" -Recurse -File -Force -ErrorAction SilentlyContinue | ? Length -gt 200MB | Sort Length -Desc | Select -First 30 |
    % { Log ("{0,8:N2} GB  {1,-10} {2}" -f ($_.Length/1GB), $_.LastWriteTime.ToString('yyyy-MM-dd'), $_.FullName) }
}

Log "`n== Log/bak/dump/iso/vhd files >50 MB =="
foreach($d in (Get-Volume | ? {$_.DriveLetter -and $_.DriveType -eq 'Fixed'})){
  Get-ChildItem "$($d.DriveLetter):\" -Recurse -File -Force -Include *.log,*.ldf,*.bak,*.trn,*.dmp,*.iso,*.vhd,*.vhdx,*.avhdx,*.old,*.tmp -ErrorAction SilentlyContinue | ? Length -gt 50MB | Sort Length -Desc | Select -First 40 |
    % { Log ("{0,8:N2} GB  {1,-10} {2}" -f ($_.Length/1GB), $_.LastWriteTime.ToString('yyyy-MM-dd'), $_.FullName) }
}

Log "`n== Shadow copies (VSS) =="
vssadmin list shadowstorage 2>&1 | % { Log $_ }
Log "`nDone. File: $out"
