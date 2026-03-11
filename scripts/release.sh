#!/usr/bin/env bash
set -euo pipefail

# Release script: build → staging → migrate → promote → production
#
# Usage:
#   ./scripts/release.sh              Deploy to staging + run migrations
#   ./scripts/release.sh --promote    Promote latest staging to production

SCOPE="n0rthwoods-projects"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAGING_ALIAS="careerjoy-staging.vercel.app"
PROD_ALIAS="careerjoy.vercel.app"

# ── Helpers ──────────────────────────────────────────────────────────

info()  { echo "==> $*"; }
ok()    { echo "  ✓ $*"; }
fail()  { echo "  ✗ $*" >&2; exit 1; }

get_deployment_url() {
  vercel ls "$SCOPE/student-system" 2>&1 \
    | grep "● Ready" | grep "Preview" | head -1 \
    | awk '{print $3}'
}

resolve_db_url() {
  local tmpenv
  tmpenv=$(mktemp)
  vercel env pull "$tmpenv" --yes >/dev/null 2>&1
  local db_url
  db_url=$(grep '^DATABASE_URL=' "$tmpenv" | cut -d'"' -f2)
  rm -f "$tmpenv"
  echo "$db_url"
}

run_migrations() {
  local label="$1"
  info "Running database migrations ($label)..."
  local db_url
  db_url=$(resolve_db_url)

  if [ -z "$db_url" ]; then
    fail "Could not resolve DATABASE_URL from Vercel env"
  fi

  DATABASE_URL="$db_url" npx prisma migrate deploy 2>&1
  ok "Migrations complete ($label)"
}

run_seeds() {
  local label="$1"
  info "Running seeds ($label)..."
  local db_url
  db_url=$(resolve_db_url)

  if [ -z "$db_url" ]; then
    fail "Could not resolve DATABASE_URL from Vercel env"
  fi

  DATABASE_URL="$db_url" npx tsx prisma/seed-questionnaire-v2.ts 2>&1
  ok "Seeds complete ($label)"
}

# ── Deploy to staging ────────────────────────────────────────────────

deploy_staging() {
  info "Deploying to STAGING..."
  echo ""

  STAGING_URL=$(vercel deploy "$PROJECT_DIR" --scope "$SCOPE" -y 2>&1 | tail -1)

  if [ -z "$STAGING_URL" ]; then
    fail "Staging deployment failed"
  fi

  ok "Build + deploy successful"
  echo "    $STAGING_URL"
  echo ""

  # Run migrations then seeds after successful deploy
  run_migrations "staging"
  run_seeds "staging"
  echo ""

  # Alias to friendly domain
  info "Setting alias $STAGING_ALIAS..."
  vercel alias "$STAGING_URL" "$STAGING_ALIAS" 2>&1
  ok "https://$STAGING_ALIAS"

  echo ""
  echo "========================================"
  echo "  STAGING ready!"
  echo "  https://$STAGING_ALIAS"
  echo "========================================"
  echo ""
  echo "Verify staging, then promote to production:"
  echo "  ./scripts/release.sh --promote"
  echo ""
}

# ── Promote to production ────────────────────────────────────────────

promote_to_production() {
  info "Promoting latest staging to PRODUCTION..."
  echo ""

  # Find the latest ready preview deployment
  STAGING_URL=$(get_deployment_url)
  if [ -z "$STAGING_URL" ]; then
    fail "No ready staging deployment found. Run ./scripts/release.sh first."
  fi

  info "Promoting: $STAGING_URL"
  echo ""

  # Deploy to production
  PROD_URL=$(vercel deploy "$PROJECT_DIR" --scope "$SCOPE" --prod -y 2>&1 | tail -1)

  if [ -z "$PROD_URL" ]; then
    fail "Production deployment failed"
  fi

  ok "Production deploy successful"
  echo "    $PROD_URL"
  echo ""

  # Run migrations then seeds against production DB
  run_migrations "production"
  run_seeds "production"
  echo ""

  # Alias to friendly domain
  info "Setting alias $PROD_ALIAS..."
  vercel alias "$PROD_URL" "$PROD_ALIAS" 2>&1
  ok "https://$PROD_ALIAS"

  echo ""
  echo "========================================"
  echo "  PRODUCTION live!"
  echo "  https://$PROD_ALIAS"
  echo "========================================"
  echo ""
}

# ── Main ─────────────────────────────────────────────────────────────

case "${1:-staging}" in
  --promote|promote|--prod|production)
    promote_to_production
    ;;
  *)
    deploy_staging
    ;;
esac
