# WordPress MCP Server

<p align="center">
  <img src="https://raw.githubusercontent.com/mangerik/WordPress-MCP/main/assets/cover.jpg" alt="WordPress MCP Server" width="100%" />
</p>

A [Model Context Protocol](https://modelcontextprotocol.io) server that lets any MCP-compatible AI client (Claude Desktop, Kiro, Cursor, Continue, etc.) read and manage a WordPress site through the official REST API.

## Features

- **30+ tools** covering posts, pages, media, comments, categories, tags, users, settings, search, and revisions.
- **Generic CPT tools** (`wp_list_items`, `wp_get_item`, `wp_create_item`, `wp_update_item`, `wp_delete_item`) for any custom post type, custom taxonomy, or third-party namespace (WooCommerce, ACF, Yoast, etc.).
- **Resources** so the LLM can attach a post/page as context: `wp://post/{id}`, `wp://page/{id}`, `wp://media/{id}`, `wp://site`.
- **Prompts** for common workflows: summarize, SEO rewrite, translate, draft.
- **Application Password** auth (recommended by WordPress core).
- **Auto-retry** on 429/5xx with `Retry-After` honored.
- **Token-saving knobs**: `_fields`, `_embed`, `context=view|edit`.
- **Safety**: destructive tool annotations, drafts default to `status=draft`.

## Requirements

- Node.js ≥ 18
- A WordPress site with the REST API enabled (default since WP 4.7).
- A user with an Application Password (WP Admin → Users → Profile → Application Passwords).

## Install

### From npm (when published)

```bash
npm install -g @mangerik/wordpress-mcp
# the `wordpress-mcp` binary is now on your PATH
```

Or run on demand without installing:

```bash
npx -y @mangerik/wordpress-mcp
```

### From source

```bash
git clone https://github.com/mangerik/WordPress-MCP.git
cd wordpress-mcp
npm install
npm run build
```

## Configure

Two auth modes are supported.

### A. Application Password (default, recommended)

Copy `.env.example` to `.env` and fill in:

```env
WP_URL=https://example.com
WP_USERNAME=your-wp-username
WP_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
```

### B. JWT (when Application Passwords are blocked or you need short-lived tokens)

Install the "JWT Authentication for WP REST API" plugin (Tmeister) or compatible. Add to `wp-config.php`:

```php
define('JWT_AUTH_SECRET_KEY', 'a long random string');
define('JWT_AUTH_CORS_ENABLE', true);
```

Then in `.env`:

```env
WP_AUTH_MODE=jwt
WP_URL=https://example.com
WP_USERNAME=your-wp-username
WP_PASSWORD=your-wp-password
# Optional override if your plugin uses a different namespace:
# WP_JWT_NAMESPACE=jwt-auth/v1

# Or skip credentials and supply a pre-issued token:
# WP_JWT_TOKEN=eyJhbGciOiJIUzI1NiIs...
```

The server fetches a token at startup, attaches it as `Authorization: Bearer …`, and you can validate it any time via the `wp_jwt_validate` tool.

Optional:

| Variable | Default | Purpose |
|----------|---------|---------|
| `WP_TIMEOUT_MS` | `30000` | Per-request timeout |
| `WP_MAX_RETRIES` | `3` | Retries on 408/425/429/5xx |
| `WP_VERIFY_SSL` | `true` | Set `false` only for local self-signed certs |
| `WP_USER_AGENT` | `WordPress-MCP-Server/1.0` | UA header |

## Use it from an MCP client

### Claude Desktop / Kiro

Add to your MCP config (`~/.kiro/settings/mcp.json` or `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "wordpress": {
      "command": "npx",
      "args": ["-y", "@mangerik/wordpress-mcp"],
      "env": {
        "WP_URL": "https://example.com",
        "WP_USERNAME": "your-wp-username",
        "WP_APP_PASSWORD": "xxxx xxxx xxxx xxxx xxxx xxxx"
      }
    }
  }
}
```

For local development (running from source):

```json
{
  "command": "node",
  "args": ["/absolute/path/to/wordpress-mcp/dist/index.js"],
  "env": { "WP_URL": "...", "WP_USERNAME": "...", "WP_APP_PASSWORD": "..." }
}
```

### Test from the terminal

```bash
WP_URL=https://example.com \
WP_USERNAME=admin \
WP_APP_PASSWORD="xxxx xxxx xxxx xxxx xxxx xxxx" \
npm run dev
```

The server speaks JSON-RPC over stdio. Use the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) to drive it interactively:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## Tool catalogue

### Site / discovery
- `wp_site_info` · `wp_get_settings` · `wp_update_settings`
- `wp_get_post_types` · `wp_get_taxonomies` · `wp_search`

### Posts
- `wp_get_posts` · `wp_get_post` · `wp_create_post` · `wp_update_post` · `wp_delete_post` · `wp_get_post_revisions`

### Pages
- `wp_get_pages` · `wp_get_page` · `wp_create_page` · `wp_update_page` · `wp_delete_page`

### Media
- `wp_get_media` · `wp_get_media_item` · `wp_upload_media_file` · `wp_upload_media_url` · `wp_update_media` · `wp_delete_media`

### Comments
- `wp_get_comments` · `wp_get_comment` · `wp_create_comment` · `wp_update_comment` · `wp_delete_comment`

### Taxonomies
- `wp_get_categories` · `wp_get_category` · `wp_create_category` · `wp_update_category` · `wp_delete_category`
- `wp_get_tags` · `wp_get_tag` · `wp_create_tag` · `wp_update_tag` · `wp_delete_tag`

### Users
- `wp_get_users` · `wp_get_user` · `wp_get_current_user` · `wp_create_user` · `wp_update_user` · `wp_delete_user`

### Generic (CPT, custom taxonomies, plugin namespaces)
- `wp_list_items` · `wp_get_item` · `wp_create_item` · `wp_update_item` · `wp_delete_item`

Use these with any REST route, e.g. `wc/v3/products`, `wp/v2/movie`, `acf/v3/posts/123`.

### WooCommerce (`wc/v3`)
Auth: set `WC_CONSUMER_KEY` + `WC_CONSUMER_SECRET` (recommended) or rely on the WP user having `manage_woocommerce`.

- Products: `wc_list_products` · `wc_get_product` · `wc_create_product` · `wc_update_product` · `wc_delete_product`
- Variations: `wc_list_variations` · `wc_create_variation`
- Categories: `wc_list_product_categories`
- Orders: `wc_list_orders` · `wc_get_order` · `wc_update_order` · `wc_create_order_note` · `wc_create_refund`
- Customers: `wc_list_customers` · `wc_get_customer`
- Coupons: `wc_list_coupons` · `wc_create_coupon`
- Reports: `wc_get_sales_report` · `wc_get_top_sellers`

### SEO (Yoast & Rank Math)
Both plugins store SEO data in post meta with different keys; one uniform tool reads/writes either.

- `seo_get_meta` — read SEO meta (`plugin: 'yoast' | 'rank_math'`)
- `seo_set_meta` — write SEO meta
- `yoast_get_head` — render Yoast `<head>` for a URL (SERP preview)
- `yoast_indexable_for_post` — Yoast computed indexable record
- `rankmath_list_redirections` · `rankmath_create_redirection` (Rank Math Pro)

> Yoast exposes its meta via REST automatically. **Rank Math** may require enabling "REST API" in the plugin settings, and meta keys must be marked `show_in_rest`.

### Block themes (WP 5.9+)
- Templates: `wp_list_templates` · `wp_get_template` · `wp_update_template`
- Template parts: `wp_list_template_parts` · `wp_get_template_part` · `wp_update_template_part`
- Patterns: `wp_list_block_patterns` · `wp_list_block_pattern_categories`
- Block types: `wp_list_block_types`
- Global styles: `wp_get_global_styles`
- Menus: `wp_list_menus` · `wp_list_menu_items`

> Template IDs are strings shaped like `theme//slug`, e.g. `twentytwentyfour//single`.

### Multisite
- `ms_list_sites` · `ms_get_site` · `ms_create_site` · `ms_update_site` · `ms_delete_site`
- `ms_list_networks` · `ms_get_network`

> Core WP does **not yet** ship `/wp/v2/sites`. These tools assume a Multisite REST plugin is installed (e.g. `brettkrueger/multisite-rest-api`). Without one you will get `rest_no_route`.

### Batch operations (WP 5.6+, `/batch/v1`)
- `wp_batch_options` — discover the per-batch limit (default 25, filterable).
- `wp_batch` — execute up to N writes in one request. GET is **not** supported by core; only `POST/PUT/PATCH/DELETE`.

```jsonc
// Example call to wp_batch
{
  "validation": "require-all-validate",
  "requests": [
    { "method": "POST", "path": "/wp/v2/posts",      "body": { "title": "First",  "content": "...", "status": "draft" } },
    { "method": "POST", "path": "/wp/v2/posts",      "body": { "title": "Second", "content": "...", "status": "draft" } },
    { "method": "POST", "path": "/wp/v2/posts/123",  "body": { "status": "publish" } }
  ]
}
```

### JWT diagnostics (only in JWT mode)
- `wp_jwt_validate` — validate the active token via `/jwt-auth/v1/token/validate`.

## Documentation

- 📖 **[USAGE.md](docs/USAGE.md)** — Real-world prompt examples (Indonesian + English): authoring, audit, WooCommerce, SEO, batch, multisite, etc.
- 📚 **[TOOLS.md](docs/TOOLS.md)** — Full reference for all 96 tools with arguments, types, and hints. Auto-generated from the running server.
- 🔒 **[SECURITY.md](SECURITY.md)** — Supply chain practices (npm provenance, no install scripts, 2FA) and how to report vulnerabilities.

## Notes & gotchas

- **`status` defaults to `draft`** for `wp_create_post` / `wp_create_page`. Override explicitly if you really want to publish.
- **Custom fields (`meta`)** must be registered server-side with `register_post_meta(..., 'show_in_rest' => true)` to be writable through REST.
- **Use `_fields`** to slim responses — e.g. `_fields: "id,title,slug"` cuts response size by ~80% for list calls.
- **`context=edit`** is required to receive raw (unfiltered) content for round-tripping through `wp_update_post`.
- The server logs to **stderr only**. Stdout is reserved for JSON-RPC framing.

## Resources

| URI | What |
|-----|------|
| `wp://site` | REST root summary (name, namespaces, etc.) |
| `wp://post/{id}` | Single post (rendered + embedded relations) |
| `wp://page/{id}` | Single page |
| `wp://media/{id}` | Single media item |

## Prompts

| Name | Args |
|------|------|
| `summarize_post` | `post_id`, `length` |
| `seo_rewrite` | `post_id`, `primary_keyword`, `target_audience?` |
| `translate_page` | `page_id`, `target_language`, `create_new?` |
| `draft_post` | `topic`, `tone?`, `word_count?` |

## License

MIT
