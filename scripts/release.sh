#!/usr/bin/env bash
set -euo pipefail

# Release script: staging → user verification → production
# Usage: ./scripts/release.sh [--prod]
#   No flags: deploy to staging only
#   --prod:   promote current staging to production

VERCEL_TOKEN="${VERCEL_TOKEN:?Set VERCEL_TOKEN environment variable}"
SCOPE="n0rthwoods-projects"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Project: $PROJECT_DIR"

deploy_staging() {
  echo ""
  echo "==> Deploying to STAGING (preview)..."
  echo ""
  STAGING_URL=$(vercel deploy "$PROJECT_DIR" \
    --token "$VERCEL_TOKEN" \
    --scope "$SCOPE" \
    -y 2>&1 | tail -1)

  echo ""
  echo "========================================"
  echo "  STAGING deployment complete!"
  echo "  URL: $STAGING_URL"
  echo "========================================"
  echo ""
  echo "Verify the staging deployment, then run:"
  echo "  ./scripts/release.sh --prod"
  echo ""
}

deploy_production() {
  echo ""
  echo "==> Deploying to PRODUCTION..."
  echo ""
  PROD_URL=$(vercel deploy "$PROJECT_DIR" \
    --token "$VERCEL_TOKEN" \
    --scope "$SCOPE" \
    --prod \
    -y 2>&1 | tail -1)

  echo ""
  echo "========================================"
  echo "  PRODUCTION deployment complete!"
  echo "  URL: $PROD_URL"
  echo "========================================"
  echo ""
}

case "${1:-staging}" in
  --prod|production)
    deploy_production
    ;;
  *)
    deploy_staging
    ;;
esac
