import { z } from "zod";
import { WordPressClient } from "../wordpress-client.js";
import type { ToolDef } from "../types.js";

export const taxonomyTools = (wp: WordPressClient): ToolDef[] => [
  // ── CATEGORIES ──────────────────────────────────────────────────────────
  {
    name: "wp_get_categories",
    title: "List categories",
    description: "List WordPress categories.",
    inputSchema: {
      page: z.number().int().positive().optional(),
      per_page: z.number().int().min(1).max(100).optional(),
      search: z.string().optional(),
      hide_empty: z.boolean().optional(),
      parent: z.number().int().optional(),
      orderby: z.enum(["id", "name", "slug", "count", "term_group"]).optional(),
      order: z.enum(["asc", "desc"]).optional(),
      _fields: z.string().optional(),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => {
      const result = await wp.categories.list(
        input as Parameters<typeof wp.categories.list>[0]
      );
      return { categories: result.data, total: result.total };
    },
  },
  {
    name: "wp_get_category",
    title: "Get a category",
    description: "Get a single category by ID.",
    inputSchema: { id: z.number().int().positive() },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => wp.categories.get((input as { id: number }).id),
  },
  {
    name: "wp_create_category",
    title: "Create a category",
    description: "Create a new category.",
    inputSchema: {
      name: z.string().min(1),
      slug: z.string().optional(),
      description: z.string().optional(),
      parent: z.number().int().optional(),
    },
    annotations: { openWorldHint: true },
    handler: async (input) => wp.categories.create(input as Record<string, unknown>),
  },
  {
    name: "wp_update_category",
    title: "Update a category",
    description: "Update a category.",
    inputSchema: {
      id: z.number().int().positive(),
      name: z.string().optional(),
      slug: z.string().optional(),
      description: z.string().optional(),
      parent: z.number().int().optional(),
    },
    annotations: { openWorldHint: true },
    handler: async (input) => {
      const { id, ...data } = input as { id: number; [k: string]: unknown };
      return wp.categories.update(id, data);
    },
  },
  {
    name: "wp_delete_category",
    title: "Delete a category",
    description: "Delete a category. Categories cannot be trashed; force is required.",
    inputSchema: {
      id: z.number().int().positive(),
      force: z.boolean().optional(),
    },
    annotations: { destructiveHint: true, openWorldHint: true },
    handler: async (input) => {
      const { id, force = true } = input as { id: number; force?: boolean };
      return wp.categories.remove(id, force);
    },
  },

  // ── TAGS ────────────────────────────────────────────────────────────────
  {
    name: "wp_get_tags",
    title: "List tags",
    description: "List WordPress tags.",
    inputSchema: {
      page: z.number().int().positive().optional(),
      per_page: z.number().int().min(1).max(100).optional(),
      search: z.string().optional(),
      hide_empty: z.boolean().optional(),
      orderby: z.enum(["id", "name", "slug", "count"]).optional(),
      order: z.enum(["asc", "desc"]).optional(),
      _fields: z.string().optional(),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => {
      const result = await wp.tags.list(input as Parameters<typeof wp.tags.list>[0]);
      return { tags: result.data, total: result.total };
    },
  },
  {
    name: "wp_get_tag",
    title: "Get a tag",
    description: "Get a single tag by ID.",
    inputSchema: { id: z.number().int().positive() },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => wp.tags.get((input as { id: number }).id),
  },
  {
    name: "wp_create_tag",
    title: "Create a tag",
    description: "Create a new tag.",
    inputSchema: {
      name: z.string().min(1),
      slug: z.string().optional(),
      description: z.string().optional(),
    },
    annotations: { openWorldHint: true },
    handler: async (input) => wp.tags.create(input as Record<string, unknown>),
  },
  {
    name: "wp_update_tag",
    title: "Update a tag",
    description: "Update a tag.",
    inputSchema: {
      id: z.number().int().positive(),
      name: z.string().optional(),
      slug: z.string().optional(),
      description: z.string().optional(),
    },
    annotations: { openWorldHint: true },
    handler: async (input) => {
      const { id, ...data } = input as { id: number; [k: string]: unknown };
      return wp.tags.update(id, data);
    },
  },
  {
    name: "wp_delete_tag",
    title: "Delete a tag",
    description: "Delete a tag. Tags cannot be trashed; force is required.",
    inputSchema: {
      id: z.number().int().positive(),
      force: z.boolean().optional(),
    },
    annotations: { destructiveHint: true, openWorldHint: true },
    handler: async (input) => {
      const { id, force = true } = input as { id: number; force?: boolean };
      return wp.tags.remove(id, force);
    },
  },
];
