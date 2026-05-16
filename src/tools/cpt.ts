import { z } from "zod";
import { WordPressClient } from "../wordpress-client.js";
import type { ToolDef } from "../types.js";

/**
 * Generic tools for working with custom post types and custom taxonomies.
 *
 * `route` examples:
 *   - "wp/v2/product"           (a CPT named `product` registered with show_in_rest)
 *   - "wp/v2/product_cat"       (a custom taxonomy)
 *   - "wc/v3/products"          (WooCommerce — different namespace)
 *   - "yoast/v1/get_head"       (Yoast)
 *
 * Use `wp_get_post_types` / `wp_get_taxonomies` / `wp_site_info` first to discover
 * what's available on the target site.
 */
export const cptTools = (wp: WordPressClient): ToolDef[] => [
  {
    name: "wp_list_items",
    title: "Generic list (any REST route)",
    description:
      "List items from any REST collection route (CPT, custom taxonomy, plugin namespace). " +
      "Pass plugin/CPT-specific params via `query`.",
    inputSchema: {
      route: z
        .string()
        .min(1)
        .describe("REST route, e.g. 'wp/v2/product' or 'wc/v3/products'"),
      query: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("Query string parameters as key/value pairs"),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => {
      const { route, query } = input as {
        route: string;
        query?: Record<string, unknown>;
      };
      const result = await wp.list(route, query);
      return { items: result.data, total: result.total, total_pages: result.pages };
    },
  },

  {
    name: "wp_get_item",
    title: "Generic get (any REST route)",
    description: "Get a single item from any REST route by ID.",
    inputSchema: {
      route: z.string().min(1),
      id: z.number().int().positive(),
      query: z.record(z.string(), z.unknown()).optional(),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => {
      const { route, id, query } = input as {
        route: string;
        id: number;
        query?: Record<string, unknown>;
      };
      return wp.get(route, id, query);
    },
  },

  {
    name: "wp_create_item",
    title: "Generic create (any REST route)",
    description:
      "Create an item on any REST route. Use `wp_get_post_types` to find supported CPT slugs.",
    inputSchema: {
      route: z.string().min(1),
      body: z.record(z.string(), z.unknown()),
    },
    annotations: { openWorldHint: true },
    handler: async (input) => {
      const { route, body } = input as { route: string; body: Record<string, unknown> };
      return wp.create(route, body);
    },
  },

  {
    name: "wp_update_item",
    title: "Generic update (any REST route)",
    description: "Update an item on any REST route by ID.",
    inputSchema: {
      route: z.string().min(1),
      id: z.number().int().positive(),
      body: z.record(z.string(), z.unknown()),
    },
    annotations: { openWorldHint: true },
    handler: async (input) => {
      const { route, id, body } = input as {
        route: string;
        id: number;
        body: Record<string, unknown>;
      };
      return wp.update(route, id, body);
    },
  },

  {
    name: "wp_delete_item",
    title: "Generic delete (any REST route)",
    description: "Delete an item on any REST route. Many endpoints require force=true.",
    inputSchema: {
      route: z.string().min(1),
      id: z.number().int().positive(),
      force: z.boolean().optional(),
    },
    annotations: { destructiveHint: true, openWorldHint: true },
    handler: async (input) => {
      const { route, id, force = false } = input as {
        route: string;
        id: number;
        force?: boolean;
      };
      return wp.remove(route, id, force);
    },
  },
];
