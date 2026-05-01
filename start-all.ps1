param(
  [int]$ApiPort = 3000,
  [int]$FrontendPort = 5500,
  [switch]$SkipDbInit
)

$ErrorActionPreference = 'Stop'

function Test-ProcessAlive {
  param([int]$ProcessId)
  try {
    Get-Process -Id $ProcessId -ErrorAction Stop | Out-Null
    return $true
  } catch {
    return $false
  }
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPath = Join-Path $root 'backend'
$frontendPath = Join-Path $root 'frontend'
$runPath = Join-Path $root '.run'
$pidFile = Join-Path $runPath 'processes.json'

if (-not (Test-Path $backendPath)) {
  throw "No se encontro carpeta backend en: $backendPath"
}

if (-not (Test-Path $frontendPath)) {
  throw "No se encontro carpeta frontend en: $frontendPath"
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'node no esta disponible en PATH.'
}

$npmCmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npmCmd) {
  throw 'npm.cmd no esta disponible en PATH.'
}

$serverFile = Join-Path $backendPath 'server.js'
if (-not (Test-Path $serverFile)) {
  throw "No se encontro server.js en: $serverFile"
}

New-Item -ItemType Directory -Force -Path $runPath | Out-Null

if (Test-Path $pidFile) {
  $previous = Get-Content $pidFile -Raw | ConvertFrom-Json
  $backendAlive = $false
  $frontendAlive = $false

  if ($previous.backendPid) {
    $backendAlive = Test-ProcessAlive -ProcessId ([int]$previous.backendPid)
  }

  if ($previous.frontendPid) {
    $frontendAlive = Test-ProcessAlive -ProcessId ([int]$previous.frontendPid)
  }

  if ($backendAlive -or $frontendAlive) {
    throw "Ya hay procesos activos. Ejecuta .\stop-all.ps1 antes de iniciar nuevamente."
  }
}

if (-not $SkipDbInit) {
  Write-Host 'Inicializando base SQL Server (db:init:sqlserver)...'
  Push-Location $backendPath
  try {
    & npm.cmd run db:init:sqlserver
    if ($LASTEXITCODE -ne 0) {
      throw "Fallo db:init:sqlserver (exit code $LASTEXITCODE)."
    }
  } finally {
    Pop-Location
  }
}

$backendCommand = "Set-Location '$backendPath'; `$env:PORT='$ApiPort'; node server.js"
$backendProcess = Start-Process -FilePath 'powershell.exe' -ArgumentList '-NoExit', '-Command', $backendCommand -PassThru

$frontendProcess = $null
$frontendUrl = "file:///$((Join-Path $frontendPath 'login.html').Replace('\','/'))"

if (Get-Command python -ErrorAction SilentlyContinue) {
  $frontendCommand = "Set-Location '$frontendPath'; python -m http.server $FrontendPort"
  $frontendProcess = Start-Process -FilePath 'powershell.exe' -ArgumentList '-NoExit', '-Command', $frontendCommand -PassThru
  $frontendUrl = "http://localhost:$FrontendPort/login.html"
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
  $frontendCommand = "Set-Location '$frontendPath'; py -m http.server $FrontendPort"
  $frontendProcess = Start-Process -FilePath 'powershell.exe' -ArgumentList '-NoExit', '-Command', $frontendCommand -PassThru
  $frontendUrl = "http://localhost:$FrontendPort/login.html"
}

Start-Sleep -Seconds 2
Start-Process $frontendUrl | Out-Null

$processData = [ordered]@{
  backendPid = $backendProcess.Id
  frontendPid = if ($frontendProcess) { $frontendProcess.Id } else { $null }
  apiUrl = "http://localhost:$ApiPort"
  frontendUrl = $frontendUrl
  startedAt = (Get-Date).ToString('o')
}

$processData | ConvertTo-Json | Set-Content -Path $pidFile -Encoding UTF8

Write-Host "Backend iniciado en http://localhost:$ApiPort (PID: $($backendProcess.Id))"
if ($frontendProcess) {
  Write-Host "Frontend servido en $frontendUrl (PID: $($frontendProcess.Id))"
} else {
  Write-Host "Frontend abierto como archivo local (sin servidor HTTP)."
}
if ($SkipDbInit) {
  Write-Host 'Inicializacion SQL omitida por parametro -SkipDbInit.'
}
Write-Host "Para detener todo: .\stop-all.ps1"
