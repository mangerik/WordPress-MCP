# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.4] - 2026-10-28

### Fixed
- `wc_update_product` no longer requires `name`; send only the fields that change.
- `wc_list_products` `category` / `tag` now take IDs (number or string), matching
  the WooCommerce API. They were documented as slugs, which matched nothing.
- `wc_update_order` no longer accepts `status: "any"` (only valid as a list filter).
- `wc_create_variation` accepts `manage_stock`, without which WooCommerce silently
  ignored `stock_quantity`. Also adds `stock_status`, `status`, `description`,
  `weight`, and sale dates.
- `wp_get_comments` `status: "approved"` / `"any"` returned no comments; they are
  now mapped to the `approve` / `all` values WordPress expects.
- `seo_set_meta` for Rank Math merges robots flags with the existing value instead
  of overwriting them (setting `noindex` used to drop `nofollow`, `noarchive`, …).
- Block template tools keep the `//` in `theme//slug` IDs instead of sending
  `%2F%2F`, which many servers reject.
- `wp_site_info` now honors `WP_VERIFY_SSL=false`.
- Tools that return a JSON array no longer fail with an invalid `structuredContent`.

### Added
- `wc_create_product` / `wc_update_product`: `date_on_sale_from`, `date_on_sale_to`.
- `wp_get_current_user` returns roles and capabilities (`context=edit`).

### Changed
- The server reports its real version (read from `package.json`) in the MCP
  handshake and the default `WP_USER_AGENT`; it previously claimed `1.0.0` / `1.0`.
- `seo_set_meta` description no longer claims Yoast exposes its meta keys over REST
  automatically, and explains how to tell when the keys aren't registered.

## [0.1.3] - 2026-05-17

### Changed
- GitHub Actions publish workflow now defaults to dist-tag `latest` instead of
  `beta`. Tag-triggered releases are treated as production releases. To
  publish a beta, run the workflow manually via `workflow_dispatch` and
  override the `tag` input.

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
