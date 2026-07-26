#!/bin/sh
# scripts/backup-scheduler.sh
#
# Scheduler entrypoint for the backup container.
# Runs daily/weekly/monthly backups at appropriate intervals.
# Uses simple sleep loops — no cron needed.

DAILY_INTERVAL=$((24 * 60 * 60))    # 24 hours
WEEKLY_CHECK_INTERVAL=$((6 * 60 * 60))  # check every 6h if it's Sunday
MONTHLY_CHECK_INTERVAL=$((6 * 60 * 60)) # check every 6h if it's 1st of month

echo "[scheduler] Installing rsync + openssh-client..."
apk add --no-cache rsync openssh-client > /dev/null 2>&1

echo "[scheduler] Starting backup scheduler..."
echo "[scheduler] Daily:  every 24h, keep 7"
echo "[scheduler] Weekly: every Sunday, keep 4"
echo "[scheduler] Monthly: 1st of month, keep 3"

# Do an immediate daily backup on startup
/scripts/backup.sh daily

while true; do
  NOW=$(date +%s)
  DAY_OF_WEEK=$(date +%u)  # 1=Mon, 7=Sun
  DAY_OF_MONTH=$(date +%d)

  # Daily: every 24h
  echo "[scheduler] Next daily backup in 24h..."
  sleep "${DAILY_INTERVAL}"
  /scripts/backup.sh daily

  # Weekly: on Sunday (day 7)
  if [ "${DAY_OF_WEEK}" = "7" ]; then
    echo "[scheduler] Running weekly backup (Sunday)..."
    /scripts/backup.sh weekly
  fi

  # Monthly: on the 1st
  if [ "${DAY_OF_MONTH}" = "01" ]; then
    echo "[scheduler] Running monthly backup (1st of month)..."
    /scripts/backup.sh monthly
  fi
done
