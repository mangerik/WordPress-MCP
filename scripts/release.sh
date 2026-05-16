#!/usr/bin/env bash
# One-stop release script. Run this AFTER:
#   1. npm login
#   2. (optional) git is committed and pushed
#
# Default: publish current version with tag `beta` (safe for 0.x).
# Promote to `latest` later with: npm dist-tag add @mangerik/wordpress-mcp@<v> latest
set -euo pipefail

cd "$(dirname "$0")/.."

# Sanity checks ---------------------------------------------------------------
if ! command -v npm >/dev/null; then
  echo "ERROR: npm not found on PATH." >&2
  exit 1
fi

if ! npm whoami >/dev/null 2>&1; then
  echo "ERROR: not logged in to npm. Run 'npm login' first." >&2
  exit 1
fi

WHOAMI=$(npm whoami)
PKG=$(node -p "require('./package.json').name")
VERSION=$(node -p "require('./package.json').version")
TAG="${1:-beta}"

echo "─────────────────────────────────────────"
echo "  package : $PKG"
echo "  version : $VERSION"
echo "  tag     : $TAG"
echo "  npm user: $WHOAMI"
echo "─────────────────────────────────────────"

# Verify the scope belongs to this user (or is one of their orgs).
SCOPE="${PKG%%/*}"
if [[ "$SCOPE" == @* ]]; then
  if ! npm access ls-packages --json 2>/dev/null | grep -q "\"$PKG\""; then
    echo "Note: '$PKG' is not yet owned by '$WHOAMI'."
    echo "      It will be created on first publish if the scope '$SCOPE' is yours."
  fi
fi

# Refuse to clobber an existing version on the registry.
if npm view "$PKG@$VERSION" version >/dev/null 2>&1; then
  echo "ERROR: $PKG@$VERSION already exists on npm. Bump the version first:" >&2
  echo "       npm version patch | minor | major" >&2
  exit 1
fi

read -rp "Publish $PKG@$VERSION with tag '$TAG'? [y/N] " ans
if [[ "$ans" != "y" && "$ans" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

# Publish (prepublishOnly will run typecheck + build + smoke automatically).
npm publish --tag "$TAG" --access public

echo
echo "✅ Published $PKG@$VERSION (tag: $TAG)"
echo "   Inspect:  https://www.npmjs.com/package/$PKG"
echo
echo "When you're ready to promote this to 'latest':"
echo "   npm dist-tag add $PKG@$VERSION latest"
