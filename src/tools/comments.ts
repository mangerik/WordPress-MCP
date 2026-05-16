import { z } from "zod";
import { WordPressClient } from "../wordpress-client.js";
import type { ToolDef } from "../types.js";

export const commentTools = (wp: WordPressClient): ToolDef[] => [
  {
    name: "wp_get_comments",
    title: "List comments",
    description: "List WordPress comments with filters.",
    inputSchema: {
      page: z.number().int().positive().optional(),
      per_page: z.number().int().min(1).max(100).optional(),
      search: z.string().optional(),
      post: z.number().int().optional(),
      status: z.enum(["approved", "hold", "spam", "trash", "any"]).optional(),
      author_email: z.string().email().optional(),
      after: z.string().optional(),
      before: z.string().optional(),
      orderby: z.enum(["date", "id", "post"]).optional(),
      order: z.enum(["asc", "desc"]).optional(),
      _fields: z.string().optional(),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => {
      const result = await wp.comments.list(
        input as Parameters<typeof wp.comments.list>[0]
      );
      return { comments: result.data, total: result.total };
    },
  },

  {
    name: "wp_get_comment",
    title: "Get a comment",
    description: "Get a single comment by ID.",
    inputSchema: { id: z.number().int().positive() },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => wp.comments.get((input as { id: number }).id),
  },

  {
    name: "wp_create_comment",
    title: "Create a comment",
    description: "Create a comment on a post.",
    inputSchema: {
      post: z.number().int().positive(),
      content: z.string().min(1),
      author_name: z.string().optional(),
      author_email: z.string().email().optional(),
      parent: z.number().int().optional(),
    },
    annotations: { openWorldHint: true },
    handler: async (input) => wp.comments.create(input as Record<string, unknown>),
  },

  {
    name: "wp_update_comment",
    title: "Update / moderate a comment",
    description:
      "Update or moderate a comment. Use status to approve / hold / spam / trash.",
    inputSchema: {
      id: z.number().int().positive(),
      content: z.string().optional(),
      status: z.enum(["approved", "hold", "spam", "trash"]).optional(),
      author_name: z.string().optional(),
      author_email: z.string().email().optional(),
    },
    annotations: { openWorldHint: true },
    handler: async (input) => {
      const { id, ...data } = input as { id: number; [k: string]: unknown };
      return wp.comments.update(id, data);
    },
  },

  {
    name: "wp_delete_comment",
    title: "Delete a comment",
    description: "Move a comment to trash, or permanently delete with force=true.",
    inputSchema: {
      id: z.number().int().positive(),
      force: z.boolean().optional(),
    },
    annotations: { destructiveHint: true, openWorldHint: true },
    handler: async (input) => {
      const { id, force = false } = input as { id: number; force?: boolean };
      return wp.comments.remove(id, force);
    },
  },
];
