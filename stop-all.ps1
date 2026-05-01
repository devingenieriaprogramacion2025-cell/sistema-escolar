$ErrorActionPreference = 'Stop'

function Stop-IfAlive {
  param([int]$ProcessId, [string]$Label)

  if (-not $ProcessId) {
    return
  }

  try {
    $proc = Get-Process -Id $ProcessId -ErrorAction Stop
    Stop-Process -Id $proc.Id -Force
    Write-Host "$Label detenido (PID: $ProcessId)"
  } catch {
    Write-Host "$Label no estaba corriendo (PID: $ProcessId)"
  }
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path (Join-Path $root '.run') 'processes.json'

if (-not (Test-Path $pidFile)) {
  Write-Host 'No existe archivo de procesos activos. Nada que detener.'
  exit 0
}

$data = Get-Content $pidFile -Raw | ConvertFrom-Json

Stop-IfAlive -ProcessId ([int]$data.backendPid) -Label 'Backend'
Stop-IfAlive -ProcessId ([int]$data.frontendPid) -Label 'Frontend'

Remove-Item $pidFile -Force
Write-Host 'Procesos detenidos y archivo de estado eliminado.'
