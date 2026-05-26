# Gera deploy-discloud.zip SEM node_modules (ideal < 5 MB)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$outZip = Join-Path $root "deploy-discloud.zip"
$temp = Join-Path $root "deploy-temp"

if (Test-Path $outZip) { Remove-Item $outZip -Force }
if (Test-Path $temp) { Remove-Item $temp -Recurse -Force }
New-Item -ItemType Directory -Path $temp | Out-Null

$excludeDirs = @(
  "node_modules", ".git", ".cursor", ".vscode", "deploy-temp",
  "coverage", "terminals", "agent-transcripts", "assets", "prisma\migrations"
)
$excludeFiles = @("deploy-discloud.zip", ".env")

Write-Host "Copiando arquivos para pasta temporaria..."

Get-ChildItem -Path $root -Force | ForEach-Object {
  $name = $_.Name
  if ($excludeDirs -contains $name) { return }
  if ($excludeFiles -contains $name) { return }
  if ($name -like "*.zip") { return }

  if ($_.PSIsContainer) {
    if ($name -eq "src") {
      # Copia src sem registerCommands (opcional local)
      $destSrc = Join-Path $temp "src"
      robocopy (Join-Path $root "src") $destSrc /E /XD scripts /XF "registerCommands.js" /NFL /NDL /NJH /NJS | Out-Null
    } elseif ($name -eq "prisma") {
      $destPrisma = Join-Path $temp "prisma"
      New-Item -ItemType Directory -Path $destPrisma | Out-Null
      Copy-Item (Join-Path $root "prisma\schema.prisma") $destPrisma
    } else {
      robocopy $_.FullName (Join-Path $temp $name) /E /NFL /NDL /NJH /NJS | Out-Null
    }
  } else {
    if ($name -match "\.md$" -and $name -ne "README.md") { return }
    if ($name -eq "discloud.config" -or $name -eq "package.json" -or $name -eq "package-lock.json") {
      Copy-Item $_.FullName (Join-Path $temp $name)
    }
  }
}

# Garante arquivos obrigatorios
@("discloud.config", "package.json", "package-lock.json") | ForEach-Object {
  $src = Join-Path $root $_
  if (Test-Path $src) { Copy-Item $src (Join-Path $temp $_) -Force }
}
$schemaSrc = Join-Path $root "prisma\schema.prisma"
if (Test-Path $schemaSrc) {
  $pDir = Join-Path $temp "prisma"
  if (-not (Test-Path $pDir)) { New-Item -ItemType Directory -Path $pDir | Out-Null }
  Copy-Item $schemaSrc (Join-Path $pDir "schema.prisma") -Force
}

Write-Host "Criando ZIP..."
Compress-Archive -Path (Join-Path $temp "*") -DestinationPath $outZip -CompressionLevel Optimal

Remove-Item $temp -Recurse -Force

$sizeMb = [math]::Round((Get-Item $outZip).Length / 1MB, 2)
Write-Host ""
Write-Host "OK: $outZip ($sizeMb MB)" -ForegroundColor Green
Write-Host "Envie APENAS este arquivo na Discloud (.upconfig)" -ForegroundColor Cyan
if ($sizeMb -gt 25) {
  Write-Host "AVISO: ZIP ainda grande. Verifique se node_modules nao entrou." -ForegroundColor Yellow
}
