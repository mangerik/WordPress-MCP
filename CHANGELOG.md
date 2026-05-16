# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] - 2026-05-17

### Added
- `SECURITY.md` documenting supply chain practices and reporting policy.
- GitHub Actions workflows for CI (test on Node 18/20/22) and tag-triggered
  publish with `--provenance` (npm provenance via OIDC).

### Changed
- Documented the GitHub Actions release flow as the recommended path; local
  publish is now positioned as a fallback.

## [0.1.1] - 2026-05-17

### Added
- `docs/USAGE.md` — bilingual (Indonesian + English) prompt examples covering
  authoring, audit, WooCommerce, SEO, block themes, batch, and multisite.
- `docs/TOOLS.md` — auto-generated reference for all 96 tools, complete with
  argument tables, types, and read-only / destructive hints.
- `npm run docs` script that regenerates `docs/TOOLS.md` from the running
  server (also runs automatically before publish).
- `docs/` is now shipped in the npm tarball.

## [0.1.0] - 2026-05-17

Initial public preview. Tagged `beta` on npm while we collect feedback from
real WordPress installations. API surface may evolve before 1.0.0.

### Added
- Initial release.
- Application Password and JWT auth modes.
- 95+ MCP tools spanning posts, pages, media, comments, taxonomies, users,
  settings, search, custom post types, WooCommerce, Yoast / Rank Math SEO,
  block themes (templates, parts, patterns, global styles, menus), multisite,
  the WP 5.6+ batch endpoint, and JWT diagnostics.
- Resources: `wp://site`, `wp://post/{id}`, `wp://page/{id}`, `wp://media/{id}`.
- Prompts: `summarize_post`, `seo_rewrite`, `translate_page`, `draft_post`.
- Auto-retry on 408/425/429/5xx with `Retry-After` honored.
- WooCommerce consumer key/secret auth path for `/wc/*` routes.
