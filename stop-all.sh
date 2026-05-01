#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/sistema-escolar"
PROJECT_SCRIPT="$PROJECT_DIR/stop-all.sh"

if [[ ! -f "$PROJECT_SCRIPT" ]]; then
  echo "No se encontro el script de detencion en: $PROJECT_SCRIPT"
  exit 1
fi

bash "$PROJECT_SCRIPT" "$@"
