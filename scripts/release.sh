#!/usr/bin/env bash
set -euo pipefail

# Release script: bump version → commit → push → deploy via SSH to production
#
# Production: 8.131.74.70 (pm2: career-system, port 3000)
# Reverse proxy: career.joysort.cn via Caddy on admin.joysort.cn
#
# Usage:
#   ./scripts/release.sh                        Bump patch + deploy
#   ./scripts/release.sh --patch                Bump patch version (default)
#   ./scripts/release.sh --minor                Bump minor version
#   ./scripts/release.sh --major                Bump major version
#   ./scripts/release.sh --no-deploy            Tag + push only, no deploy
#   ./scripts/release.sh --deploy-only          Deploy without version bump

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROD_HOST="root@8.131.74.70"
PROD_DIR="/opt/career_system"
BUMP="patch"
DO_DEPLOY=true
DEPLOY_ONLY=false

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
  --no-deploy             Tag and push only (no SSH deploy)
  --deploy-only           Deploy current code without version bump
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

ssh_cmd() {
  ssh "$PROD_HOST" "source /root/.nvm/nvm.sh && $1"
}

# ── Parse args ───────────────────────────────────────────────────────

for arg in "$@"; do
  case "$arg" in
    --patch)       BUMP="patch" ;;
    --minor)       BUMP="minor" ;;
    --major)       BUMP="major" ;;
    --no-deploy)   DO_DEPLOY=false ;;
    --deploy-only) DEPLOY_ONLY=true ;;
    -h|--help)     usage; exit 0 ;;
    *)             fail "Unknown option: $arg (use --help)" ;;
  esac
done

cd "$PROJECT_DIR"

# ── Deploy-only mode ────────────────────────────────────────────────

if [ "$DEPLOY_ONLY" = true ]; then
  info "Deploying current code to production..."
  ssh_cmd "cd $PROD_DIR && git pull origin main && npm install --registry=https://registry.npmmirror.com && npx prisma migrate deploy && npm run build && pm2 restart career-system"
  ok "Deployed"

  info "Verifying..."
  ssh "$PROD_HOST" "curl -sf http://127.0.0.1:3000/api/health" && ok "Health check passed" || fail "Health check failed"
  echo ""
  echo "========================================"
  echo "  Deployed to career.joysort.cn"
  echo "========================================"
  exit 0
fi

# ── Pre-flight checks ───────────────────────────────────────────────

if [ -n "$(git status --porcelain)" ]; then
  fail "Working tree is not clean. Commit or stash changes first."
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
  fail "Must be on 'main' branch to release (currently on '$BRANCH')"
fi

git fetch origin main
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
if [ "$LOCAL" != "$REMOTE" ]; then
  fail "Local main is not in sync with origin/main. Pull or push first."
fi

# ── Version bump + tag ──────────────────────────────────────────────

CURRENT_VERSION=$(get_current_version)
NEW_VERSION=$(bump_version "$CURRENT_VERSION" "$BUMP")
TAG="v$NEW_VERSION"

info "Bumping version: $CURRENT_VERSION → $NEW_VERSION"

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

info "Pushing to origin..."
git push origin main --tags
ok "Pushed main + $TAG"
echo ""

# ── Deploy to production via SSH ────────────────────────────────────

if [ "$DO_DEPLOY" = true ]; then
  info "Deploying $TAG to production..."
  ssh_cmd "cd $PROD_DIR && git pull origin main && npm install --registry=https://registry.npmmirror.com && npx prisma migrate deploy && npm run build && pm2 restart career-system"
  ok "Deployed $TAG"

  info "Verifying..."
  ssh "$PROD_HOST" "curl -sf http://127.0.0.1:3000/api/health" && ok "Health check passed" || fail "Health check failed"
else
  info "Skipping deploy (--no-deploy)"
fi

echo ""
echo "========================================"
echo "  $TAG released!"
echo "  https://career.joysort.cn"
echo "========================================"
echo ""
