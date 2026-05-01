#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
<<<<<<< HEAD
PROJECT_DIR="$SCRIPT_DIR/sistema-escolar"
PROJECT_SCRIPT="$PROJECT_DIR/stop-all.sh"

if [[ ! -f "$PROJECT_SCRIPT" ]]; then
  echo "No se encontro el script de detencion en: $PROJECT_SCRIPT"
  exit 1
fi

bash "$PROJECT_SCRIPT" "$@"
=======
POWERSHELL_SCRIPT="$SCRIPT_DIR/stop-all.ps1"

if ! command -v powershell.exe >/dev/null 2>&1; then
  echo "No se encontro powershell.exe en PATH."
  exit 1
fi

if command -v cygpath >/dev/null 2>&1; then
  POWERSHELL_SCRIPT="$(cygpath -w "$POWERSHELL_SCRIPT")"
fi

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$POWERSHELL_SCRIPT" "$@"
>>>>>>> 9b34815032d39153fdfdabe528d6c4a3f300019e
