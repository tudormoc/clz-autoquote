# SERVER2019 – disk space notes (C:)

Last updated: 2026-10-06. SERVER2019 = 192.168.1.91, domain controller, Hyper-V VM, **live production**.
Rule: work step by step, read-only first, never delete data without the owner's OK.

## Access
- From TMTHINK (workgroup) WinRM and `\\SERVER2019\C$` do NOT work (Utente10 is not admin, TrustedHosts not set).
- Working method: RDP to the server, run commands in an elevated PowerShell, paste the output back.
- Read-only report script: `scripts/server2019-space-report.ps1` (writes `C:\space-report.txt` on the server).

## Where the space is (C: = 649 GB)
| Path | Size | Notes |
|---|---|---|
| `C:\Archivi\Office\Preventivi LeZana` | 336 GB, 568k files | **LIVE quotes, owner says NOTHING can be deleted** |
| `C:\Archivi\Office\Scansioni` / `PM` | 17.6 / 12.2 GB | live |
| `C:\Archivi\Users` | 20 GB | live (Users share) |
| `C:\Bus` | 138 GB | live SQL data: `Data\COOPZANARDI.mdf` 77 GB, `.ldf` 6 GB; `Backup\*.BAK` ~45 GB (same disk as the DB) |
| `C:\Qualitas` | 66 GB | mostly NetPro logs (see below) |
| `C:\Windows` | 29 GB | WinSxS 8.5 GB, 0 reclaimable |
| `pagefile.sys` | 8 GB | leave |

## Done on 2026-10-06 (free: 6.1 GB -> 43.3 GB)
1. Stopped wuauserv/bits, emptied `C:\Windows\SoftwareDistribution\Download` (+6 GB), restarted services.
2. `DISM /Online /Cleanup-Image /StartComponentCleanup` (+~1.3 GB).
3. Deleted NetPro logs older than 7 days, then older than 3 days (~33 GB total).
A scheduled cleanup task was offered and **declined**: cleanup is manual.

## 2026-10-09 – second cleanup
Free space had fallen 43.3 -> 18.3 GB in 3 days (~8 GB/day, all NetPro logs: 44.9 GB in the two Log folders).
Same 3-day-retention delete: 18.3 -> 39.4 GB. Check again about every 3 days.

## Manual NetPro log cleanup (repeat when space is low)
NPBatchServer writes ~6 GB of logs per day (a 1 GB `.out` every few hours), so C: refills in about a week.
Logs live in `C:\Qualitas\NPBatchServer\Log` and `C:\Qualitas\NPServer\Log`. Elevated PowerShell on SERVER2019:

```powershell
# 1) preview (read-only): total and how much is older than 3 days
gci 'C:\Qualitas\NPBatchServer\Log','C:\Qualitas\NPServer\Log' -File -Force | ? { $_.LastWriteTime -lt (Get-Date).AddDays(-3) } | measure Length -Sum

# 2) delete (permanent, no recycle bin) files older than 3 days, then show free space
gci 'C:\Qualitas\NPBatchServer\Log','C:\Qualitas\NPServer\Log' -File -Force | ? { $_.LastWriteTime -lt (Get-Date).AddDays(-3) } | Remove-Item -Force; Get-Volume C | ft DriveLetter,@{n='FreeGB';e={[math]::Round($_.SizeRemaining/1GB,1)}}
```

## Still open / ideas for next time
- **Real fix**: grow the VM virtual disk from the Hyper-V host (host not inspected yet; run `Get-VM Server2019 | Get-VMHardDiskDrive | Get-VHD` and `Get-Volume` ON THE HOST). Check VHD type and host free space first.
- Ask NetPro support why NPBatchServer logs 1 GB every few hours (log level too verbose?).
- `C:\Bus\Backup\*.BAK` (~45 GB) sit on the same disk as the databases: consider moving them to another machine/disk (not deleting).
- Pending Windows updates (Defender, MSRT, **SQL Server 2019 KB5122773**, .NET KB5126144, cumulative KB5120238) not installed: do it in a maintenance window, with enough free space, and Server2019 VM must start before srvPME after any reboot (see 2026-09-28 autologon incident).
- Not yet inspected: `C:\Windows` remainder (~20 GB), `C:\Users` (5.8 GB), `C:\Program Files*` (9 GB), `C:\ProgramData` (3 GB), `C:\mongodb` (1.2 GB, likely in use).
- Don't touch `Windows\Installer\$PatchCache$` by hand (use Disk Cleanup).
