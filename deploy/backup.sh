#!/usr/bin/env bash
# ==========================================
# FlowCart Database Backup Script
# Keeps newest 14 backups and prunes older dumps.
# ==========================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_ROOT}/backups"
TIMESTAMP="$(date +%Y-%m-%d_%H%M%S)"
DUMP_FILE="${BACKUP_DIR}/flowcart-${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting FlowCart database backup..."

# Execute pg_dump inside Postgres container
docker compose -f "${SCRIPT_DIR}/docker-compose.yml" exec -T postgres \
  pg_dump -U flowcart -Fc flowcart > "$DUMP_FILE"

# Verify dump file was generated and is not empty
if [ ! -s "$DUMP_FILE" ]; then
  echo "Error: Backup file $DUMP_FILE was not created or is empty!" >&2
  rm -f "$DUMP_FILE"
  exit 1
fi

DUMP_SIZE="$(du -h "$DUMP_FILE" | cut -f1)"
echo "[$(date)] Backup completed successfully: $DUMP_FILE ($DUMP_SIZE)"

# Prune old backups: keep newest 14, delete the rest
echo "[$(date)] Pruning old backups (keeping newest 14)..."
find "$BACKUP_DIR" -name "flowcart-*.dump" -type f | sort -r | tail -n +15 | while read -r old_dump; do
  echo "Removing old backup: $old_dump"
  rm -f "$old_dump"
done

echo "[$(date)] Backup process finished successfully."
