#!/usr/bin/env bash
#
# Restore the latest RDS snapshot, replace the current DB instance with its data,
# then clean up the temporary restored instance.
#
# Usage: ./scripts/restore-rds-snapshot.sh
#
# Prerequisites:
#   - AWS CLI v2 installed and configured
#   - Sufficient IAM permissions for RDS operations
#
set -euo pipefail

# ── Configuration ────────────────────────────────────────────────────────────
DB_INSTANCE_ID="estate-doctor"
AWS_REGION="us-east-2"
TEMP_INSTANCE_ID="${DB_INSTANCE_ID}-restored-$(date +%s)"
OLD_INSTANCE_ID="${DB_INSTANCE_ID}-old-$(date +%s)"

# ── Helper functions ─────────────────────────────────────────────────────────
log()  { echo "$(date '+%H:%M:%S') [INFO]  $*"; }
warn() { echo "$(date '+%H:%M:%S') [WARN]  $*" >&2; }
die()  { echo "$(date '+%H:%M:%S') [ERROR] $*" >&2; exit 1; }

wait_for_status() {
  local instance="$1"
  local target_status="$2"
  local timeout="${3:-1800}"  # default 30 min
  local elapsed=0
  local interval=30

  log "Waiting for ${instance} to reach status '${target_status}' (timeout: ${timeout}s)..."
  while true; do
    local status
    status=$(aws rds describe-db-instances \
      --db-instance-identifier "$instance" \
      --region "$AWS_REGION" \
      --query 'DBInstances[0].DBInstanceStatus' \
      --output text 2>/dev/null || echo "not-found")

    if [[ "$status" == "$target_status" ]]; then
      log "${instance} is now '${target_status}'"
      return 0
    fi

    if (( elapsed >= timeout )); then
      die "Timed out waiting for ${instance} to reach '${target_status}' (current: ${status})"
    fi

    echo -n "  status: ${status} (${elapsed}s elapsed)..."$'\r'
    sleep "$interval"
    (( elapsed += interval ))
  done
}

wait_for_delete() {
  local instance="$1"
  local timeout="${2:-1800}"
  local elapsed=0
  local interval=30

  log "Waiting for ${instance} to be deleted..."
  while true; do
    local status
    status=$(aws rds describe-db-instances \
      --db-instance-identifier "$instance" \
      --region "$AWS_REGION" \
      --query 'DBInstances[0].DBInstanceStatus' \
      --output text 2>/dev/null || echo "deleted")

    if [[ "$status" == "deleted" ]]; then
      log "${instance} has been deleted"
      return 0
    fi

    if (( elapsed >= timeout )); then
      die "Timed out waiting for ${instance} to be deleted (current: ${status})"
    fi

    echo -n "  status: ${status} (${elapsed}s elapsed)..."$'\r'
    sleep "$interval"
    (( elapsed += interval ))
  done
}

# ── Step 1: Find the latest automated snapshot ──────────────────────────────
log "Finding latest snapshot for ${DB_INSTANCE_ID}..."

SNAPSHOT_ID=$(aws rds describe-db-snapshots \
  --db-instance-identifier "$DB_INSTANCE_ID" \
  --region "$AWS_REGION" \
  --query 'sort_by(DBSnapshots, &SnapshotCreateTime)[-1].DBSnapshotIdentifier' \
  --output text)

if [[ -z "$SNAPSHOT_ID" || "$SNAPSHOT_ID" == "None" ]]; then
  die "No snapshots found for ${DB_INSTANCE_ID}"
fi

log "Latest snapshot: ${SNAPSHOT_ID}"

# ── Step 2: Get current instance config (to match settings) ─────────────────
log "Fetching current instance configuration..."

INSTANCE_CLASS=$(aws rds describe-db-instances \
  --db-instance-identifier "$DB_INSTANCE_ID" \
  --region "$AWS_REGION" \
  --query 'DBInstances[0].DBInstanceClass' \
  --output text)

VPC_SECURITY_GROUPS=$(aws rds describe-db-instances \
  --db-instance-identifier "$DB_INSTANCE_ID" \
  --region "$AWS_REGION" \
  --query 'DBInstances[0].VpcSecurityGroups[*].VpcSecurityGroupId' \
  --output text | tr '\t' ',')

SUBNET_GROUP=$(aws rds describe-db-instances \
  --db-instance-identifier "$DB_INSTANCE_ID" \
  --region "$AWS_REGION" \
  --query 'DBInstances[0].DBSubnetGroup.DBSubnetGroupName' \
  --output text)

PARAM_GROUP=$(aws rds describe-db-instances \
  --db-instance-identifier "$DB_INSTANCE_ID" \
  --region "$AWS_REGION" \
  --query 'DBInstances[0].DBParameterGroups[0].DBParameterGroupName' \
  --output text)

MULTI_AZ=$(aws rds describe-db-instances \
  --db-instance-identifier "$DB_INSTANCE_ID" \
  --region "$AWS_REGION" \
  --query 'DBInstances[0].MultiAZ' \
  --output text)

PUBLIC_ACCESS=$(aws rds describe-db-instances \
  --db-instance-identifier "$DB_INSTANCE_ID" \
  --region "$AWS_REGION" \
  --query 'DBInstances[0].PubliclyAccessible' \
  --output text)

log "Instance class: ${INSTANCE_CLASS}"
log "Security groups: ${VPC_SECURITY_GROUPS}"
log "Subnet group: ${SUBNET_GROUP}"
log "Parameter group: ${PARAM_GROUP}"
log "Multi-AZ: ${MULTI_AZ}"
log "Publicly accessible: ${PUBLIC_ACCESS}"

# ── Step 3: Confirm with user ───────────────────────────────────────────────
echo ""
echo "================================================================"
echo "  RESTORE PLAN"
echo "================================================================"
echo "  Source snapshot:   ${SNAPSHOT_ID}"
echo "  Current instance:  ${DB_INSTANCE_ID}"
echo "  Temp instance:     ${TEMP_INSTANCE_ID}"
echo "  Instance class:    ${INSTANCE_CLASS}"
echo ""
echo "  This will:"
echo "    1. Restore snapshot → ${TEMP_INSTANCE_ID}"
echo "    2. Rename ${DB_INSTANCE_ID} → ${OLD_INSTANCE_ID}"
echo "    3. Rename ${TEMP_INSTANCE_ID} → ${DB_INSTANCE_ID}"
echo "    4. Delete ${OLD_INSTANCE_ID}"
echo ""
echo "  ⚠️  Your app will have ~1-2 min downtime during the rename."
echo "================================================================"
echo ""
read -p "Proceed? (yes/no): " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
  die "Aborted by user"
fi

# ── Step 4: Restore snapshot to temp instance ────────────────────────────────
log "Restoring snapshot to ${TEMP_INSTANCE_ID}..."

RESTORE_ARGS=(
  --db-instance-identifier "$TEMP_INSTANCE_ID"
  --db-snapshot-identifier "$SNAPSHOT_ID"
  --db-instance-class "$INSTANCE_CLASS"
  --db-subnet-group-name "$SUBNET_GROUP"
  --region "$AWS_REGION"
  --no-multi-az
)

if [[ "$PUBLIC_ACCESS" == "True" ]]; then
  RESTORE_ARGS+=(--publicly-accessible)
else
  RESTORE_ARGS+=(--no-publicly-accessible)
fi

aws rds restore-db-instance-from-db-snapshot "${RESTORE_ARGS[@]}"

wait_for_status "$TEMP_INSTANCE_ID" "available"

# ── Step 5: Apply security groups and parameter group to restored instance ───
log "Applying security groups and parameter group to ${TEMP_INSTANCE_ID}..."

MODIFY_ARGS=(
  --db-instance-identifier "$TEMP_INSTANCE_ID"
  --vpc-security-group-ids $(echo "$VPC_SECURITY_GROUPS" | tr ',' ' ')
  --db-parameter-group-name "$PARAM_GROUP"
  --region "$AWS_REGION"
  --apply-immediately
)

aws rds modify-db-instance "${MODIFY_ARGS[@]}"

wait_for_status "$TEMP_INSTANCE_ID" "available"

# ── Step 6: Rename current instance to old ───────────────────────────────────
log "Renaming ${DB_INSTANCE_ID} → ${OLD_INSTANCE_ID}..."

aws rds modify-db-instance \
  --db-instance-identifier "$DB_INSTANCE_ID" \
  --new-db-instance-identifier "$OLD_INSTANCE_ID" \
  --region "$AWS_REGION" \
  --apply-immediately

wait_for_status "$OLD_INSTANCE_ID" "available"

# ── Step 7: Rename restored instance to original name ────────────────────────
log "Renaming ${TEMP_INSTANCE_ID} → ${DB_INSTANCE_ID}..."

aws rds modify-db-instance \
  --db-instance-identifier "$TEMP_INSTANCE_ID" \
  --new-db-instance-identifier "$DB_INSTANCE_ID" \
  --region "$AWS_REGION" \
  --apply-immediately

wait_for_status "$DB_INSTANCE_ID" "available"

# ── Step 8: Delete old instance (skip final snapshot) ────────────────────────
log "Deleting old instance ${OLD_INSTANCE_ID}..."

aws rds delete-db-instance \
  --db-instance-identifier "$OLD_INSTANCE_ID" \
  --skip-final-snapshot \
  --region "$AWS_REGION"

wait_for_delete "$OLD_INSTANCE_ID"

# ── Done ─────────────────────────────────────────────────────────────────────
NEW_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier "$DB_INSTANCE_ID" \
  --region "$AWS_REGION" \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text)

echo ""
echo "================================================================"
echo "  ✅ RESTORE COMPLETE"
echo "================================================================"
echo "  Instance:  ${DB_INSTANCE_ID}"
echo "  Endpoint:  ${NEW_ENDPOINT}"
echo "  Snapshot:  ${SNAPSHOT_ID}"
echo ""
echo "  The endpoint should be the same as before."
echo "  Verify your app connects successfully."
echo "================================================================"
