import { z } from "zod";
import { WordPressClient } from "../wordpress-client.js";
import type { ToolDef } from "../types.js";

export const pageTools = (wp: WordPressClient): ToolDef[] => [
  {
    name: "wp_get_pages",
    title: "List pages",
    description: "List WordPress pages.",
    inputSchema: {
      page: z.number().int().positive().optional(),
      per_page: z.number().int().min(1).max(100).optional(),
      search: z.string().optional(),
      status: z.enum(["publish", "draft", "private", "pending", "any"]).optional(),
      parent: z.number().int().optional(),
      orderby: z
        .enum(["date", "id", "title", "modified", "menu_order", "slug"])
        .optional(),
      order: z.enum(["asc", "desc"]).optional(),
      _fields: z.string().optional(),
      _embed: z.boolean().optional(),
      context: z.enum(["view", "edit"]).optional(),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => {
      const result = await wp.pages.list(input as Parameters<typeof wp.pages.list>[0]);
      return { pages: result.data, total: result.total, total_pages: result.pages };
    },
  },

  {
    name: "wp_get_page",
    title: "Get a page",
    description: "Get a single WordPress page by ID.",
    inputSchema: {
      id: z.number().int().positive(),
      context: z.enum(["view", "edit"]).optional(),
      _fields: z.string().optional(),
      _embed: z.boolean().optional(),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => {
      const { id, ...rest } = input as { id: number; [k: string]: unknown };
      return wp.pages.get(id, rest);
    },
  },

  {
    name: "wp_create_page",
    title: "Create a page",
    description: "Create a new WordPress page (default status=draft).",
    inputSchema: {
      title: z.string().min(1),
      content: z.string(),
      excerpt: z.string().optional(),
      status: z.enum(["publish", "draft", "private", "pending"]).optional(),
      slug: z.string().optional(),
      parent: z.number().int().optional(),
      menu_order: z.number().int().optional(),
      featured_media: z.number().int().optional(),
      template: z.string().optional(),
      comment_status: z.enum(["open", "closed"]).optional(),
      meta: z.record(z.string(), z.unknown()).optional(),
    },
    annotations: { openWorldHint: true },
    handler: async (input) => wp.pages.create({ status: "draft", ...input }),
  },

  {
    name: "wp_update_page",
    title: "Update a page",
    description: "Update an existing WordPress page.",
    inputSchema: {
      id: z.number().int().positive(),
      title: z.string().optional(),
      content: z.string().optional(),
      excerpt: z.string().optional(),
      status: z.enum(["publish", "draft", "private", "pending"]).optional(),
      slug: z.string().optional(),
      parent: z.number().int().optional(),
      menu_order: z.number().int().optional(),
      featured_media: z.number().int().optional(),
      template: z.string().optional(),
      meta: z.record(z.string(), z.unknown()).optional(),
    },
    annotations: { openWorldHint: true },
    handler: async (input) => {
      const { id, ...data } = input as { id: number; [k: string]: unknown };
      return wp.pages.update(id, data);
    },
  },

  {
    name: "wp_delete_page",
    title: "Delete a page",
    description: "Move a page to trash, or permanently delete with force=true.",
    inputSchema: {
      id: z.number().int().positive(),
      force: z.boolean().optional(),
    },
    annotations: { destructiveHint: true, openWorldHint: true },
    handler: async (input) => {
      const { id, force = false } = input as { id: number; force?: boolean };
      return wp.pages.remove(id, force);
    },
  },
];
