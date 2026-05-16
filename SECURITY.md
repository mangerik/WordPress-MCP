# Security Policy

## Reporting a vulnerability

If you discover a security issue, **please do not open a public GitHub issue**.
Instead, email the maintainer directly:

📧 erikhidayatullah23@gmail.com

We aim to respond within 7 days and disclose responsibly once a fix is shipped.

## Supply chain practices

This package follows these supply chain security measures:

- **npm provenance** — every release is signed via [npm's provenance feature](https://docs.npmjs.com/generating-provenance-statements)
  using GitHub Actions OIDC, so consumers can cryptographically verify each
  tarball was built from a specific commit in the public repo.
- **No install / postinstall scripts** — the package never executes code on
  install.
- **No native bindings** — pure TypeScript / JavaScript, easy to audit.
- **2FA on npm publish** — the maintainer's npm account requires two-factor
  authentication for write actions.
- **Pinned dependencies** — runtime deps are kept to four well-known packages
  (`@modelcontextprotocol/sdk`, `axios`, `form-data`, `zod`). No transitive
  surprises from one-letter abandoned modules.
- **Reproducible builds** — `npm pack --dry-run` produces a deterministic
  list; CI runs `typecheck → build → smoke → docs` before every publish.

## Verifying a published version

```bash
# Inspect the provenance attestation:
npm audit signatures

# Or for a specific install:
npm install @mangerik/wordpress-mcp
npx @npmcli/get-provenance @mangerik/wordpress-mcp
```

If `npm audit signatures` reports anything other than “verified”, do not
trust that install — please report to the email above.
