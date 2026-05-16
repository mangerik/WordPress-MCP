import { z } from "zod";
import { WordPressClient } from "../wordpress-client.js";
import type { ToolDef } from "../types.js";

const statusEnum = z.enum([
  "publish",
  "draft",
  "private",
  "pending",
  "future",
]);
const statusFilter = z.enum([...statusEnum.options, "any"]);
const orderEnum = z.enum(["asc", "desc"]);

export const postTools = (wp: WordPressClient): ToolDef[] => [
  {
    name: "wp_get_posts",
    title: "List posts",
    description:
      "List WordPress posts with filters. Use `_fields` to keep responses small (e.g. 'id,title,slug').",
    inputSchema: {
      page: z.number().int().positive().optional(),
      per_page: z.number().int().min(1).max(100).optional(),
      search: z.string().optional(),
      status: statusFilter.optional(),
      categories: z.array(z.number().int()).optional(),
      tags: z.array(z.number().int()).optional(),
      author: z.number().int().optional(),
      orderby: z
        .enum(["date", "id", "title", "modified", "relevance", "rand", "slug"])
        .optional(),
      order: orderEnum.optional(),
      after: z.string().optional().describe("ISO8601 lower bound (inclusive)"),
      before: z.string().optional().describe("ISO8601 upper bound (inclusive)"),
      slug: z.array(z.string()).optional(),
      _fields: z.string().optional(),
      _embed: z.boolean().optional(),
      context: z.enum(["view", "edit"]).optional(),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => {
      const result = await wp.posts.list(input as Parameters<typeof wp.posts.list>[0]);
      return { posts: result.data, total: result.total, total_pages: result.pages };
    },
  },

  {
    name: "wp_get_post",
    title: "Get a post",
    description: "Get a single WordPress post by ID.",
    inputSchema: {
      id: z.number().int().positive(),
      context: z.enum(["view", "edit"]).optional(),
      _fields: z.string().optional(),
      _embed: z.boolean().optional(),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => {
      const { id, ...rest } = input as { id: number; [k: string]: unknown };
      return wp.posts.get(id, rest);
    },
  },

  {
    name: "wp_create_post",
    title: "Create a post",
    description:
      "Create a new WordPress post. Defaults to status=draft for safety. " +
      "Set `meta` to write custom fields (must be registered server-side).",
    inputSchema: {
      title: z.string().min(1),
      content: z.string(),
      excerpt: z.string().optional(),
      status: statusEnum.optional(),
      slug: z.string().optional(),
      categories: z.array(z.number().int()).optional(),
      tags: z.array(z.number().int()).optional(),
      featured_media: z.number().int().optional(),
      date: z.string().optional(),
      comment_status: z.enum(["open", "closed"]).optional(),
      ping_status: z.enum(["open", "closed"]).optional(),
      format: z
        .enum([
          "standard",
          "aside",
          "chat",
          "gallery",
          "link",
          "image",
          "quote",
          "status",
          "video",
          "audio",
        ])
        .optional(),
      sticky: z.boolean().optional(),
      author: z.number().int().optional(),
      meta: z.record(z.string(), z.unknown()).optional(),
    },
    annotations: { openWorldHint: true },
    handler: async (input) => {
      const body = { status: "draft", ...input };
      return wp.posts.create(body);
    },
  },

  {
    name: "wp_update_post",
    title: "Update a post",
    description: "Update an existing WordPress post.",
    inputSchema: {
      id: z.number().int().positive(),
      title: z.string().optional(),
      content: z.string().optional(),
      excerpt: z.string().optional(),
      status: statusEnum.optional(),
      slug: z.string().optional(),
      categories: z.array(z.number().int()).optional(),
      tags: z.array(z.number().int()).optional(),
      featured_media: z.number().int().optional(),
      date: z.string().optional(),
      comment_status: z.enum(["open", "closed"]).optional(),
      ping_status: z.enum(["open", "closed"]).optional(),
      sticky: z.boolean().optional(),
      author: z.number().int().optional(),
      meta: z.record(z.string(), z.unknown()).optional(),
    },
    annotations: { openWorldHint: true },
    handler: async (input) => {
      const { id, ...data } = input as { id: number; [k: string]: unknown };
      return wp.posts.update(id, data);
    },
  },

  {
    name: "wp_delete_post",
    title: "Delete a post",
    description:
      "Move a post to trash, or permanently delete with `force=true`. " +
      "Force-delete is irreversible.",
    inputSchema: {
      id: z.number().int().positive(),
      force: z
        .boolean()
        .optional()
        .describe("Permanently delete (skip trash). Default false."),
    },
    annotations: { destructiveHint: true, openWorldHint: true },
    handler: async (input) => {
      const { id, force = false } = input as { id: number; force?: boolean };
      return wp.posts.remove(id, force);
    },
  },

  {
    name: "wp_get_post_revisions",
    title: "List post revisions",
    description: "List revisions of a given post (audit trail).",
    inputSchema: {
      id: z.number().int().positive(),
      per_page: z.number().int().min(1).max(100).optional(),
      _fields: z.string().optional(),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => {
      const { id, ...rest } = input as { id: number; [k: string]: unknown };
      const result = await wp.posts.revisions(id, rest);
      return { revisions: result.data, total: result.total };
    },
  },
];
