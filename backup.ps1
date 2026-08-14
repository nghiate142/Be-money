# Sao lưu database. Chạy: .\backup.ps1
$stamp = Get-Date -Format 'yyyy-MM-dd_HHmm'
$dest = Join-Path $PSScriptRoot 'backups'
if (-not (Test-Path $dest)) { New-Item -ItemType Directory $dest | Out-Null }
Copy-Item (Join-Path $PSScriptRoot 'dev.db') (Join-Path $dest "dev_$stamp.db")
Write-Host "Đã lưu: backups\dev_$stamp.db"
