# Release checklist

This file is for the maintainer (you). Outside contributors won't run this.

## One-time setup (only on a fresh machine)

1. **Have an npm account.** If not: <https://www.npmjs.com/signup>.
2. **Decide on the package name.** Currently `@mangerik/wordpress-mcp`. If your
   npm username is **not** `socai`, edit the `name` field in `package.json`
   to use your own scope (e.g. `@yourname/wordpress-mcp`) or pick a flat name
   like `wordpress-mcp` (must be globally unique on npm).
3. **Enable 2FA on npm** for security:
   <https://docs.npmjs.com/configuring-two-factor-authentication>.
   With 2FA "auth-and-writes", `npm publish` will prompt for an OTP.
4. **Login on this machine:**
   ```bash
   npm login
   ```
5. **(Optional) Set up a public GitHub repo** and update `repository`,
   `bugs`, and `homepage` URLs in `package.json` if they don't match.

## Per-release

The recommended path is **release via GitHub Actions** so each tarball gets
[npm provenance](https://docs.npmjs.com/generating-provenance-statements)
(cryptographically tied to a public commit). Local publishing is still
supported as a fallback.

### A. GitHub Actions release (recommended)

```bash
# 1. Bump version + create git tag
npm version patch     # 0.1.1 → 0.1.2 (bug fix)
npm version minor     # 0.1.1 → 0.2.0 (feature, no breaking change)
npm version major     # 0.1.1 → 1.0.0 (breaking change OR public stable)

# 2. Update CHANGELOG.md and amend the version commit:
git add CHANGELOG.md
git commit --amend --no-edit

# 3. Push commit + tag to GitHub:
git push --follow-tags
```

The `Publish to npm` workflow triggers on the `v*` tag. It runs typecheck,
build, smoke test, doc generation, and publishes with `--provenance`.

**One-time setup:**

1. Create a public GitHub repo at `https://github.com/mangerik/WordPress-MCP`.
2. Generate an npm **automation** token (no 2FA prompt) at
   <https://www.npmjs.com/settings/mangerik/tokens> → "Classic Token" →
   type "Automation". Granular tokens with bypass-2FA also work.
3. In the GitHub repo, go to **Settings → Secrets and variables → Actions**
   → New repository secret → name `NPM_TOKEN`, value the token.

### B. Local fallback

```bash
# Publish with tag `beta`:
./scripts/release.sh           # interactive, prompts for OTP if 2FA on
./scripts/release.sh latest    # publishes with tag `latest`
```

## Promoting from `beta` to `latest`

When you're confident a beta version is solid:

```bash
npm dist-tag add @mangerik/wordpress-mcp@0.1.0 latest
```

Users running `npx -y @mangerik/wordpress-mcp` (no tag) will then get this version
by default.

## Verifying after publish

1. Check the package page: `https://www.npmjs.com/package/@mangerik/wordpress-mcp`
2. Test install in a clean directory:
   ```bash
   cd /tmp && mkdir wp-mcp-test && cd wp-mcp-test
   npm install @mangerik/wordpress-mcp@beta
   ./node_modules/.bin/wordpress-mcp   # should fail loudly with config error
                                       # (proves the binary is wired correctly)
   ```
3. Update your Kiro / Claude Desktop MCP config to use the published version:
   ```json
   {
     "command": "npx",
     "args": ["-y", "@mangerik/wordpress-mcp@beta"],
     "env": { "WP_URL": "...", "WP_USERNAME": "...", "WP_APP_PASSWORD": "..." }
   }
   ```

## Unpublishing (emergency only)

npm allows unpublish of a version **only within 72 hours** of publish.
After that, you must publish a new version with the fix.

```bash
npm unpublish @mangerik/wordpress-mcp@0.1.0
# or deprecate without removing:
npm deprecate @mangerik/wordpress-mcp@0.1.0 "Bad release; use 0.1.1+"
```
