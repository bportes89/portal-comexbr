#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Substitui Redis 3.x (Windows) por Memurai Developer (compatível Redis 6+).

.DESCRIPTION
  BullMQ exige Redis 5+. O pacote winget Redis.Redis instala versão 3.x.
  Memurai Developer é gratuito para desenvolvimento e roda na porta 6379.
#>

$ErrorActionPreference = 'Stop'

Write-Host '=== Portal ComexBr: upgrade Redis para Memurai ===' -ForegroundColor Cyan

$legacyService = Get-Service -Name 'Redis' -ErrorAction SilentlyContinue
if ($legacyService) {
  Write-Host 'Parando servico Redis 3.x legado...' -ForegroundColor Yellow
  Stop-Service -Name 'Redis' -Force
  Set-Service -Name 'Redis' -StartupType Disabled
}

Write-Host 'Instalando Memurai Developer (winget)...' -ForegroundColor Yellow
winget install Memurai.MemuraiDeveloper --accept-package-agreements --accept-source-agreements

$memuraiService = Get-Service -Name 'Memurai' -ErrorAction SilentlyContinue
if (-not $memuraiService) {
  throw 'Servico Memurai nao encontrado apos instalacao.'
}

Write-Host 'Iniciando Memurai...' -ForegroundColor Yellow
Set-Service -Name 'Memurai' -StartupType Automatic
Start-Service -Name 'Memurai'

Start-Sleep -Seconds 2

$memuraiCli = @(
  "${env:ProgramFiles}\Memurai\memurai-cli.exe",
  "${env:ProgramFiles(x86)}\Memurai\memurai-cli.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($memuraiCli) {
  $pong = & $memuraiCli PING 2>$null
  $info = & $memuraiCli INFO server 2>$null | Select-String 'redis_version'
  Write-Host "Memurai respondeu: $pong" -ForegroundColor Green
  Write-Host $info -ForegroundColor Green
} else {
  Write-Host 'memurai-cli nao encontrado, mas o servico Memurai esta em execucao.' -ForegroundColor Yellow
}

Write-Host ''
Write-Host 'Proximo passo: reinicie o backend NestJS.' -ForegroundColor Cyan
Write-Host '  cd backend' -ForegroundColor Gray
Write-Host '  npm run start:dev' -ForegroundColor Gray
Write-Host ''
Write-Host 'Validacao: Invoke-RestMethod http://localhost:3000/system/status' -ForegroundColor Cyan
