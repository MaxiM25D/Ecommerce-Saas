param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\backups")
)

$ErrorActionPreference = "Stop"

if (-not $env:DATABASE_URL) {
  throw "DATABASE_URL no está configurada"
}

$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $resolvedOutput | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = Join-Path $resolvedOutput "infinityshop-$timestamp.dump"

& pg_dump --dbname $env:DATABASE_URL --format custom --no-owner --no-acl --file $backupPath
if ($LASTEXITCODE -ne 0) {
  Remove-Item -LiteralPath $backupPath -ErrorAction SilentlyContinue
  throw "pg_dump finalizó con código $LASTEXITCODE"
}

$hash = Get-FileHash -Algorithm SHA256 -LiteralPath $backupPath
Write-Output "Backup creado: $backupPath"
Write-Output "SHA256: $($hash.Hash)"
