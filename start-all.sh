#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
POWERSHELL_SCRIPT="$SCRIPT_DIR/start-all.ps1"

if ! command -v powershell.exe >/dev/null 2>&1; then
  echo "No se encontro powershell.exe en PATH."
  exit 1
fi

if command -v cygpath >/dev/null 2>&1; then
  POWERSHELL_SCRIPT="$(cygpath -w "$POWERSHELL_SCRIPT")"
fi

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$POWERSHELL_SCRIPT" "$@"
