import { z } from "zod";
import { WordPressClient } from "../wordpress-client.js";
import type { ToolDef } from "../types.js";

/**
 * Tools for WordPress block themes (WP 5.9+):
 *   - wp_template (full templates)
 *   - wp_template_part (header / footer / etc.)
 *   - block-patterns / block-pattern-categories
 *   - block-types
 *   - global-styles
 *   - menus / menu-items / menu-locations (WP 6.6+ menus REST in core; many sites
 *     also have Gutenberg's nav blocks via wp/v2/navigation)
 *
 * Templates use string IDs of the form `theme//slug`, e.g. `twentytwentyfour//single`.
 */

const orderEnum = z.enum(["asc", "desc"]);

export const blockTools = (wp: WordPressClient): ToolDef[] => [
  // ── Templates (full block templates) ───────────────────────────────────
  {
    name: "wp_list_templates",
    title: "Block themes: list templates",
    description:
      "List block theme templates (wp_template). IDs look like 'theme//slug'.",
    inputSchema: {
      theme: z.string().optional().describe("Filter by theme slug"),
      area: z.string().optional().describe("Filter by template area (e.g. 'header')"),
      post_type: z.string().optional().describe("Filter by post type the template applies to"),
      _fields: z.string().optional(),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => {
      const r = await wp.list("wp/v2/templates", input);
      return { templates: r.data, total: r.total };
    },
  },
  {
    name: "wp_get_template",
    title: "Block themes: get template",
    description: "Get a single template by 'theme//slug' ID.",
    inputSchema: { id: z.string().min(1) },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => {
      const { id } = input as { id: string };
      return wp.raw({
        method: "GET",
        path: `/wp/v2/templates/${encodeURIComponent(id)}`,
      });
    },
  },
  {
    name: "wp_update_template",
    title: "Block themes: update template",
    description:
      "Update a block template by 'theme//slug' ID. Pass content (block markup) " +
      "and/or title/description.",
    inputSchema: {
      id: z.string().min(1),
      content: z.string().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.enum(["publish", "draft", "auto-draft", "trash"]).optional(),
    },
    annotations: { openWorldHint: true },
    handler: async (input) => {
      const { id, ...body } = input as { id: string; [k: string]: unknown };
      return wp.raw({
        method: "POST",
        path: `/wp/v2/templates/${encodeURIComponent(id)}`,
        body,
      });
    },
  },

  // ── Template parts ─────────────────────────────────────────────────────
  {
    name: "wp_list_template_parts",
    title: "Block themes: list template parts",
    description:
      "List template parts (wp_template_part), e.g. header / footer fragments.",
    inputSchema: {
      theme: z.string().optional(),
      area: z.string().optional(),
      _fields: z.string().optional(),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => {
      const r = await wp.list("wp/v2/template-parts", input);
      return { template_parts: r.data, total: r.total };
    },
  },
  {
    name: "wp_get_template_part",
    title: "Block themes: get template part",
    description: "Get a single template part by 'theme//slug' ID.",
    inputSchema: { id: z.string().min(1) },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => {
      const { id } = input as { id: string };
      return wp.raw({
        method: "GET",
        path: `/wp/v2/template-parts/${encodeURIComponent(id)}`,
      });
    },
  },
  {
    name: "wp_update_template_part",
    title: "Block themes: update template part",
    description: "Update a template part by 'theme//slug' ID.",
    inputSchema: {
      id: z.string().min(1),
      content: z.string().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      area: z.string().optional(),
    },
    annotations: { openWorldHint: true },
    handler: async (input) => {
      const { id, ...body } = input as { id: string; [k: string]: unknown };
      return wp.raw({
        method: "POST",
        path: `/wp/v2/template-parts/${encodeURIComponent(id)}`,
        body,
      });
    },
  },

  // ── Block patterns ─────────────────────────────────────────────────────
  {
    name: "wp_list_block_patterns",
    title: "Block themes: list patterns",
    description: "List block patterns (registered via PHP, theme.json, or pattern directory).",
    inputSchema: {},
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async () => {
      const r = await wp.list("wp/v2/block-patterns/patterns");
      return { patterns: r.data, total: r.total };
    },
  },
  {
    name: "wp_list_block_pattern_categories",
    title: "Block themes: list pattern categories",
    description: "List the categories used to group block patterns.",
    inputSchema: {},
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async () => {
      const r = await wp.list("wp/v2/block-patterns/categories");
      return { categories: r.data, total: r.total };
    },
  },

  // ── Block types ────────────────────────────────────────────────────────
  {
    name: "wp_list_block_types",
    title: "Block themes: list block types",
    description: "List registered Gutenberg block types.",
    inputSchema: {
      namespace: z.string().optional().describe("Filter by block namespace, e.g. 'core'"),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => {
      const r = await wp.list("wp/v2/block-types", input);
      return { block_types: r.data, total: r.total };
    },
  },

  // ── Global styles ──────────────────────────────────────────────────────
  {
    name: "wp_get_global_styles",
    title: "Block themes: get global styles for a theme",
    description:
      "Get the active global styles record (theme.json overrides) for a given stylesheet.",
    inputSchema: {
      stylesheet: z.string().describe("Theme stylesheet slug, e.g. 'twentytwentyfour'"),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => {
      const { stylesheet } = input as { stylesheet: string };
      return wp.raw({
        method: "GET",
        path: `/wp/v2/global-styles/themes/${encodeURIComponent(stylesheet)}`,
      });
    },
  },

  // ── Menus (WP 5.9+ classic menus REST) ─────────────────────────────────
  {
    name: "wp_list_menus",
    title: "Menus: list",
    description: "List navigation menus.",
    inputSchema: { _fields: z.string().optional() },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => {
      const r = await wp.list("wp/v2/menus", input);
      return { menus: r.data, total: r.total };
    },
  },
  {
    name: "wp_list_menu_items",
    title: "Menus: list items",
    description: "List items inside menus, optionally filtered by menu ID.",
    inputSchema: {
      menus: z.array(z.number().int()).optional(),
      per_page: z.number().int().min(1).max(100).optional(),
      _fields: z.string().optional(),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => {
      const r = await wp.list("wp/v2/menu-items", input);
      return { menu_items: r.data, total: r.total };
    },
  },
];
