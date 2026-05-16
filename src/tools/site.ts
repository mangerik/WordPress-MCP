import { z } from "zod";
import { WordPressClient } from "../wordpress-client.js";
import type { ToolDef } from "../types.js";

export const siteTools = (wp: WordPressClient): ToolDef[] => [
  {
    name: "wp_site_info",
    title: "Site info",
    description:
      "Get the REST API root index: site name, description, namespaces, and discovered routes. " +
      "Use this to detect WooCommerce, Yoast, or other plugins exposing REST endpoints.",
    inputSchema: {},
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async () => {
      const info = (await wp.siteInfo()) as Record<string, unknown>;
      // Trim noisy fields to save tokens.
      const slim = {
        name: info.name,
        description: info.description,
        url: info.url,
        home: info.home,
        gmt_offset: info.gmt_offset,
        timezone_string: info.timezone_string,
        site_logo: info.site_logo,
        site_icon_url: info.site_icon_url,
        namespaces: info.namespaces,
        authentication: info.authentication,
      };
      return slim;
    },
  },

  {
    name: "wp_get_settings",
    title: "Get site settings",
    description: "Get WordPress site settings (requires manage_options).",
    inputSchema: {},
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async () => wp.settings(),
  },

  {
    name: "wp_update_settings",
    title: "Update site settings",
    description:
      "Update site settings such as title, description, timezone, or default category. " +
      "Use with caution.",
    inputSchema: {
      title: z.string().optional(),
      description: z.string().optional(),
      url: z.string().url().optional(),
      email: z.string().email().optional(),
      timezone: z.string().optional(),
      date_format: z.string().optional(),
      time_format: z.string().optional(),
      start_of_week: z.number().int().min(0).max(6).optional(),
      language: z.string().optional(),
      use_smilies: z.boolean().optional(),
      default_category: z.number().int().optional(),
      default_post_format: z.string().optional(),
      posts_per_page: z.number().int().positive().optional(),
      default_ping_status: z.enum(["open", "closed"]).optional(),
      default_comment_status: z.enum(["open", "closed"]).optional(),
    },
    annotations: { openWorldHint: true },
    handler: async (input) => wp.updateSettings(input as Record<string, unknown>),
  },

  {
    name: "wp_get_post_types",
    title: "List post types",
    description:
      "List registered post types (post, page, attachment, plus any custom post types).",
    inputSchema: {},
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async () => wp.types(),
  },

  {
    name: "wp_get_taxonomies",
    title: "List taxonomies",
    description: "List registered taxonomies (category, post_tag, plus custom taxonomies).",
    inputSchema: {},
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async () => wp.taxonomies(),
  },

  {
    name: "wp_search",
    title: "Search content",
    description:
      "Universal search across posts, pages, and other public content via /wp/v2/search.",
    inputSchema: {
      query: z.string().min(1),
      type: z.enum(["post", "term", "post-format"]).optional(),
      subtype: z.string().optional().describe("Post type slug or taxonomy slug"),
      page: z.number().int().positive().optional(),
      per_page: z.number().int().min(1).max(100).optional(),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => {
      const { query, ...rest } = input as { query: string } & Record<string, unknown>;
      const result = await wp.search(query, rest as Parameters<typeof wp.search>[1]);
      return { results: result.data, total: result.total };
    },
  },
];
