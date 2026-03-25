#!/bin/bash
# Hourly RDS snapshot script
# Takes a manual snapshot every hour and deletes snapshots older than 3 days.
# Intended to run via cron on the EC2 instance.

set -euo pipefail

DB_INSTANCE="estate-doctor"
REGION="us-east-2"
RETENTION_HOURS=72  # 3 days
SNAPSHOT_PREFIX="hourly-${DB_INSTANCE}"
TIMESTAMP=$(date -u +"%Y-%m-%d-%H-%M")
SNAPSHOT_ID="${SNAPSHOT_PREFIX}-${TIMESTAMP}"

echo "[$(date -u)] Creating snapshot: ${SNAPSHOT_ID}"
aws rds create-db-snapshot \
  --db-instance-identifier "$DB_INSTANCE" \
  --db-snapshot-identifier "$SNAPSHOT_ID" \
  --region "$REGION" \
  --tags Key=Type,Value=hourly-automated \
  --no-cli-pager

echo "[$(date -u)] Snapshot ${SNAPSHOT_ID} creation initiated."

# --- Clean up old snapshots ---
CUTOFF=$(date -u -d "-${RETENTION_HOURS} hours" +"%Y-%m-%dT%H:%M" 2>/dev/null \
  || date -u -v-${RETENTION_HOURS}H +"%Y-%m-%dT%H:%M")  # Linux || macOS

echo "[$(date -u)] Deleting snapshots older than ${RETENTION_HOURS} hours (before ${CUTOFF})..."

aws rds describe-db-snapshots \
  --db-instance-identifier "$DB_INSTANCE" \
  --snapshot-type manual \
  --region "$REGION" \
  --query "DBSnapshots[?starts_with(DBSnapshotIdentifier, '${SNAPSHOT_PREFIX}')].[DBSnapshotIdentifier,SnapshotCreateTime]" \
  --output text \
  --no-cli-pager \
| while read -r snap_id snap_time; do
    # Compare snapshot time to cutoff
    if [[ "$snap_time" < "$CUTOFF" ]]; then
      echo "  Deleting old snapshot: ${snap_id} (created ${snap_time})"
      aws rds delete-db-snapshot \
        --db-snapshot-identifier "$snap_id" \
        --region "$REGION" \
        --no-cli-pager || true
    fi
  done

echo "[$(date -u)] Done."
