#!/usr/bin/env bash
# ==========================================
# FlowCart Database Restore Script
# Restores a pg_dump custom format archive into FlowCart Postgres.
# Usage: ./deploy/restore.sh backups/flowcart-YYYY-MM-DD.dump
# ==========================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ $# -lt 1 ]; then
  echo "Usage: $0 <path-to-dump-file>" >&2
  echo "Example: $0 backups/flowcart-2026-10-10.dump" >&2
  exit 1
fi

DUMP_FILE="$1"

if [ ! -f "$DUMP_FILE" ]; then
  echo "Error: Backup file '$DUMP_FILE' does not exist!" >&2
  exit 1
fi

echo "[$(date)] WARNING: This operation will overwrite existing database data in 'flowcart'."
read -r -p "Are you sure you want to restore '$DUMP_FILE'? (y/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Restore cancelled by user."
  exit 0
fi

echo "[$(date)] Restoring database from '$DUMP_FILE'..."

# Terminate active client connections to flowcart db before restore
docker compose -f "${SCRIPT_DIR}/docker-compose.yml" exec -T postgres psql -U flowcart -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'flowcart' AND pid <> pg_backend_pid();" > /dev/null 2>&1 || true

# Execute pg_restore inside Postgres container
cat "$DUMP_FILE" | docker compose -f "${SCRIPT_DIR}/docker-compose.yml" exec -T postgres \
  pg_restore --clean --if-exists -U flowcart -d flowcart --no-owner --role=flowcart

echo "[$(date)] Restore completed successfully."
echo "[$(date)] Restarting API and Worker services..."
docker compose -f "${SCRIPT_DIR}/docker-compose.yml" restart api worker

echo "[$(date)] System services restarted. FlowCart is ready."
