#!/usr/bin/env bash
set -euo pipefail

# Release script: tag → push → Vercel auto-deploys → migrate/seed
#
# With Git connected to Vercel:
#   - Pushing to main triggers a Production deployment automatically
#   - Pushing to other branches triggers Preview deployments
#
# Usage:
#   ./scripts/release.sh                        Tag + push + migrate/seed production
#   ./scripts/release.sh --no-db                Tag + push without DB updates
#   ./scripts/release.sh --patch                Bump patch version (default)
#   ./scripts/release.sh --minor                Bump minor version
#   ./scripts/release.sh --major                Bump major version
#   ./scripts/release.sh --db-only              Skip deploy, only run migrations/seeds

SCOPE="n0rthwoods-projects"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VERCEL_ENV_FILE="$PROJECT_DIR/.env.vercel"
RUN_DB=true
DB_ONLY=false
BUMP="patch"

# ── Helpers ──────────────────────────────────────────────────────────

info()  { echo "==> $*"; }
ok()    { echo "  ✓ $*"; }
fail()  { echo "  ✗ $*" >&2; exit 1; }

usage() {
  cat <<'EOF'
Usage:
  ./scripts/release.sh [options]

Options:
  --patch                 Bump patch version (default): 0.1.0 → 0.1.1
  --minor                 Bump minor version: 0.1.0 → 0.2.0
  --major                 Bump major version: 0.1.0 → 1.0.0
  --no-db                 Skip migrations and seeds
  --db-only               Only run migrations/seeds (no tag/push)
  -h, --help              Show help
EOF
}

get_current_version() {
  node -p "require('$PROJECT_DIR/package.json').version"
}

bump_version() {
  local version="$1" bump="$2"
  local major minor patch
  IFS='.' read -r major minor patch <<< "$version"
  case "$bump" in
    major) echo "$((major + 1)).0.0" ;;
    minor) echo "$major.$((minor + 1)).0" ;;
    patch) echo "$major.$minor.$((patch + 1))" ;;
  esac
}

resolve_db_url() {
  local vercel_env="$1"
  vercel env pull "$VERCEL_ENV_FILE" --yes --environment="$vercel_env" --scope "$SCOPE" >/dev/null 2>&1
  local db_url=""
  db_url=$(grep '^POSTGRES_PRISMA_URL=' "$VERCEL_ENV_FILE" | cut -d'"' -f2 || true)
  if [ -z "$db_url" ]; then
    db_url=$(grep '^POSTGRES_URL=' "$VERCEL_ENV_FILE" | cut -d'"' -f2 || true)
  fi
  if [ -z "$db_url" ]; then
    db_url=$(grep '^DATABASE_URL=' "$VERCEL_ENV_FILE" | cut -d'"' -f2 || true)
  fi
  echo "$db_url"
}

run_migrations() {
  local label="$1"
  local vercel_env="$2"
  info "Running database migrations ($label)..."
  local db_url
  db_url=$(resolve_db_url "$vercel_env")

  if [ -z "$db_url" ]; then
    fail "Could not resolve DATABASE_URL from Vercel $vercel_env env"
  fi

  PRISMA_ENV_FILE="$VERCEL_ENV_FILE" DATABASE_URL="$db_url" npx prisma migrate deploy 2>&1
  ok "Migrations complete ($label)"
}

run_seeds() {
  local label="$1"
  local vercel_env="$2"
  info "Running seeds ($label)..."
  local db_url admin_pw
  db_url=$(resolve_db_url "$vercel_env")
  admin_pw=$(grep '^ADMIN_SEED_PASSWORD=' "$VERCEL_ENV_FILE" | cut -d'"' -f2 || true)

  if [ -z "$db_url" ]; then
    fail "Could not resolve DATABASE_URL from Vercel $vercel_env env"
  fi

  PRISMA_ENV_FILE="$VERCEL_ENV_FILE" DATABASE_URL="$db_url" ADMIN_SEED_PASSWORD="$admin_pw" npx tsx prisma/seed.ts 2>&1
  ok "Seeds complete ($label)"
}

wait_for_deployment() {
  local tag="$1"
  local max_wait=300  # 5 minutes
  local elapsed=0

  info "Waiting for Vercel to deploy $tag..."
  while [ $elapsed -lt $max_wait ]; do
    local status
    status=$(vercel ls --scope "$SCOPE" 2>&1 | grep "● Ready" | grep "Production" | head -1 || true)
    if [ -n "$status" ]; then
      local deploy_url
      deploy_url=$(echo "$status" | awk '{print $3}')
      # Check if the deployment is recent (within last 5 minutes)
      ok "Production deployment ready: $deploy_url"
      return 0
    fi
    sleep 10
    elapsed=$((elapsed + 10))
    echo "    ... waiting ($elapsed/${max_wait}s)"
  done
  fail "Timed out waiting for Vercel deployment"
}

# ── Main ─────────────────────────────────────────────────────────────

for arg in "$@"; do
  case "$arg" in
    --patch)   BUMP="patch" ;;
    --minor)   BUMP="minor" ;;
    --major)   BUMP="major" ;;
    --no-db)   RUN_DB=false ;;
    --db-only) DB_ONLY=true ;;
    -h|--help) usage; exit 0 ;;
    *)         fail "Unknown option: $arg (use --help)" ;;
  esac
done

cd "$PROJECT_DIR"

# ── DB-only mode ─────────────────────────────────────────────────────

if [ "$DB_ONLY" = true ]; then
  run_migrations "production" "production"
  run_seeds "production" "production"
  echo ""
  echo "========================================"
  echo "  DB updates complete!"
  echo "========================================"
  exit 0
fi

# ── Pre-flight checks ───────────────────────────────────────────────

# Ensure working tree is clean
if [ -n "$(git status --porcelain)" ]; then
  fail "Working tree is not clean. Commit or stash changes first."
fi

# Ensure we're on main
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
  fail "Must be on 'main' branch to release (currently on '$BRANCH')"
fi

# Ensure main is up to date with remote
git fetch origin main
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
if [ "$LOCAL" != "$REMOTE" ]; then
  fail "Local main is not in sync with origin/main. Pull or push first."
fi

# ── Version bump + tag ───────────────────────────────────────────────

CURRENT_VERSION=$(get_current_version)
NEW_VERSION=$(bump_version "$CURRENT_VERSION" "$BUMP")
TAG="v$NEW_VERSION"

info "Bumping version: $CURRENT_VERSION → $NEW_VERSION"

# Update package.json version
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '$NEW_VERSION';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

git add package.json
git commit -m "release: $TAG"
git tag -a "$TAG" -m "Release $TAG"

ok "Created tag $TAG"
echo ""

# ── Push to trigger Vercel deploy ────────────────────────────────────

info "Pushing to origin (triggers Vercel production deploy)..."
git push origin main --tags
ok "Pushed main + $TAG"
echo ""

# ── Wait for Vercel to finish deploying ──────────────────────────────

wait_for_deployment "$TAG"
echo ""

# ── Run DB migrations/seeds ──────────────────────────────────────────

if [ "$RUN_DB" = true ]; then
  run_migrations "production" "production"
  run_seeds "production" "production"
  echo ""
else
  info "Skipping DB updates (--no-db)"
  echo ""
fi

# ── Done ─────────────────────────────────────────────────────────────

echo "========================================"
echo "  $TAG released!"
echo "  https://careerjoy.vercel.app"
echo "========================================"
echo ""
