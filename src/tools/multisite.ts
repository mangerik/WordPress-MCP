import { z } from "zod";
import { WordPressClient } from "../wordpress-client.js";
import type { ToolDef } from "../types.js";

/**
 * Multisite tools.
 *
 * Important: as of WordPress 6.x, **core does NOT yet ship a `/wp/v2/sites`
 * endpoint** — it is on the multisite roadmap but unreleased. The tools below
 * call `wp/v2/sites` (and `wp/v2/networks` where useful) on the assumption
 * that a Multisite REST plugin (e.g. brettkrueger/multisite-rest-api) is
 * installed. If you get a 404 with code `rest_no_route`, the plugin is
 * missing or your build of WordPress doesn't expose the endpoint.
 *
 * Fallback: use the generic `wp_list_items` / `wp_create_item` tools on
 * a custom namespace your plugin exposes.
 */
export const multisiteTools = (wp: WordPressClient): ToolDef[] => [
  {
    name: "ms_list_sites",
    title: "Multisite: list sites",
    description:
      "List all sites in the network. Requires a Multisite REST plugin to be installed. " +
      "Returns 404 (rest_no_route) on plain core WP.",
    inputSchema: {
      page: z.number().int().positive().optional(),
      per_page: z.number().int().min(1).max(100).optional(),
      search: z.string().optional(),
      network: z.number().int().optional(),
      _fields: z.string().optional(),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => {
      const r = await wp.list("wp/v2/sites", input);
      return { sites: r.data, total: r.total };
    },
  },
  {
    name: "ms_get_site",
    title: "Multisite: get site",
    description: "Get a single network site by blog ID.",
    inputSchema: { id: z.number().int().positive() },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => wp.get("wp/v2/sites", (input as { id: number }).id),
  },
  {
    name: "ms_create_site",
    title: "Multisite: create site",
    description:
      "Create a new site (subsite) in the network. Field names follow the multisite-rest-api plugin conventions; adjust if your plugin differs.",
    inputSchema: {
      domain: z.string().min(1),
      path: z.string().default("/"),
      title: z.string().optional(),
      network_id: z.number().int().optional(),
      meta: z.record(z.string(), z.unknown()).optional(),
    },
    annotations: { openWorldHint: true },
    handler: async (input) => wp.create("wp/v2/sites", input as Record<string, unknown>),
  },
  {
    name: "ms_update_site",
    title: "Multisite: update site",
    description: "Update a network site by blog ID.",
    inputSchema: {
      id: z.number().int().positive(),
      domain: z.string().optional(),
      path: z.string().optional(),
      title: z.string().optional(),
      meta: z.record(z.string(), z.unknown()).optional(),
    },
    annotations: { openWorldHint: true },
    handler: async (input) => {
      const { id, ...data } = input as { id: number; [k: string]: unknown };
      return wp.update("wp/v2/sites", id, data);
    },
  },
  {
    name: "ms_delete_site",
    title: "Multisite: delete site",
    description: "Delete a network site. Always destructive — there is no trash for sites.",
    inputSchema: {
      id: z.number().int().positive(),
      force: z.boolean().optional(),
    },
    annotations: { destructiveHint: true, openWorldHint: true },
    handler: async (input) => {
      const { id, force = true } = input as { id: number; force?: boolean };
      return wp.remove("wp/v2/sites", id, force);
    },
  },

  // ── Networks ───────────────────────────────────────────────────────────
  {
    name: "ms_list_networks",
    title: "Multisite: list networks",
    description: "List networks (multi-network installs). Same plugin requirement as sites.",
    inputSchema: {
      page: z.number().int().positive().optional(),
      per_page: z.number().int().min(1).max(100).optional(),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => {
      const r = await wp.list("wp/v2/networks", input);
      return { networks: r.data, total: r.total };
    },
  },
  {
    name: "ms_get_network",
    title: "Multisite: get network",
    description: "Get a single network by ID.",
    inputSchema: { id: z.number().int().positive() },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => wp.get("wp/v2/networks", (input as { id: number }).id),
  },
];
