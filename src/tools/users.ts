import { z } from "zod";
import { WordPressClient } from "../wordpress-client.js";
import type { ToolDef } from "../types.js";

export const userTools = (wp: WordPressClient): ToolDef[] => [
  {
    name: "wp_get_users",
    title: "List users",
    description: "List WordPress users.",
    inputSchema: {
      page: z.number().int().positive().optional(),
      per_page: z.number().int().min(1).max(100).optional(),
      search: z.string().optional(),
      roles: z.array(z.string()).optional(),
      orderby: z
        .enum(["id", "include", "name", "registered_date", "slug", "email", "url"])
        .optional(),
      order: z.enum(["asc", "desc"]).optional(),
      _fields: z.string().optional(),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => {
      const result = await wp.users.list(input as Parameters<typeof wp.users.list>[0]);
      return { users: result.data, total: result.total };
    },
  },

  {
    name: "wp_get_user",
    title: "Get a user",
    description: "Get a single user by ID.",
    inputSchema: { id: z.number().int().positive() },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => wp.users.get((input as { id: number }).id),
  },

  {
    name: "wp_get_current_user",
    title: "Get current user",
    description:
      "Get the currently authenticated user (the WP_USERNAME used to start this server).",
    inputSchema: {},
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async () => wp.users.me(),
  },

  {
    name: "wp_create_user",
    title: "Create a user",
    description: "Create a new WordPress user. Requires the `create_users` capability.",
    inputSchema: {
      username: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(8),
      name: z.string().optional(),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      url: z.string().url().optional(),
      description: z.string().optional(),
      roles: z.array(z.string()).optional(),
    },
    annotations: { openWorldHint: true },
    handler: async (input) => wp.users.create(input as Record<string, unknown>),
  },

  {
    name: "wp_update_user",
    title: "Update a user",
    description: "Update a user's profile or role.",
    inputSchema: {
      id: z.number().int().positive(),
      email: z.string().email().optional(),
      name: z.string().optional(),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      url: z.string().url().optional(),
      description: z.string().optional(),
      roles: z.array(z.string()).optional(),
      password: z.string().min(8).optional(),
    },
    annotations: { openWorldHint: true },
    handler: async (input) => {
      const { id, ...data } = input as { id: number; [k: string]: unknown };
      return wp.users.update(id, data);
    },
  },

  {
    name: "wp_delete_user",
    title: "Delete a user",
    description:
      "Permanently delete a user and reassign their content to another user. " +
      "Always force-deletes (WP requirement).",
    inputSchema: {
      id: z.number().int().positive(),
      reassign_to: z
        .number()
        .int()
        .positive()
        .describe("User ID to receive the deleted user's content."),
    },
    annotations: { destructiveHint: true, openWorldHint: true },
    handler: async (input) => {
      const { id, reassign_to } = input as { id: number; reassign_to: number };
      return wp.users.remove(id, reassign_to);
    },
  },
];
