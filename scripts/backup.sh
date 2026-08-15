#!/bin/sh
# scripts/backup.sh
#
# PostgreSQL backup script for RepLog.
# Dumps the DB locally, then rsyncs to a remote host via SSH.
#
# Usage: backup.sh <retention_label>  (e.g., daily, weekly, monthly)
#
# Retention (local + remote):
#   daily   – keep last 7
#   weekly  – keep last 4
#   monthly – keep last 3

set -e

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_LABEL="${1:-daily}"
DB_HOST="${DB_HOST:-database}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-gym}"
DB_NAME="${DB_NAME:-gymdb}"
DB_PASSWORD="${DB_PASSWORD:-gym}"

# Remote rsync target (set in docker-compose environment)
REMOTE_USER="${REMOTE_USER:-}"
REMOTE_HOST="${REMOTE_HOST:-}"
REMOTE_PATH="${REMOTE_PATH:-}"

DATE=$(date +%Y-%m-%d)
FILE="replog_${DATE}_${RETENTION_LABEL}.sql.gz"

# Each retention label lives in its own subfolder, locally and on the remote.
SUB_DIR="${BACKUP_DIR}/${RETENTION_LABEL}"
mkdir -p "${SUB_DIR}"

echo "[backup] $(date -Iseconds) Starting ${RETENTION_LABEL} backup..."

export PGPASSWORD="${DB_PASSWORD}"

# ── Dump ──────────────────────────────────────────────────────────────
pg_dump \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --no-owner \
  --no-acl \
  | gzip > "${SUB_DIR}/${FILE}"

echo "[backup] $(date -Iseconds) Saved: ${SUB_DIR}/${FILE} ($(du -h "${SUB_DIR}/${FILE}" | cut -f1))"

# ── Rsync to remote ───────────────────────────────────────────────────
if [ -n "${REMOTE_USER}" ] && [ -n "${REMOTE_HOST}" ] && [ -n "${REMOTE_PATH}" ]; then
  echo "[backup] Syncing to ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/${RETENTION_LABEL} ..."
  rsync -avz -e "ssh -o StrictHostKeyChecking=accept-new" \
    "${SUB_DIR}/" \
    "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/${RETENTION_LABEL}/" \
    || echo "[backup] WARNING: rsync failed — local backup is still safe at ${SUB_DIR}/${FILE}"

  echo "[backup] $(date -Iseconds) Rsync done."
else
  echo "[backup] No remote target configured — keeping local backup only."
fi

# ── Rotate old local backups ──────────────────────────────────────────
case "${RETENTION_LABEL}" in
  daily)   KEEP=7 ;;
  weekly)  KEEP=4 ;;
  monthly) KEEP=3 ;;
  *)       KEEP=7 ;;
esac

ls -1t "${SUB_DIR}"/replog_*_${RETENTION_LABEL}.sql.gz 2>/dev/null \
  | tail -n +$((KEEP + 1)) \
  | while read -r old; do
    echo "[backup] Removing old backup: $(basename "${old}")"
    rm -f "${old}"
  done

echo "[backup] $(date -Iseconds) Done. Keeping last ${KEEP} ${RETENTION_LABEL} backups."
