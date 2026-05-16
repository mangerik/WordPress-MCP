import { z } from "zod";
import { WordPressClient } from "../wordpress-client.js";
import type { ToolDef } from "../types.js";

export const mediaTools = (wp: WordPressClient): ToolDef[] => [
  {
    name: "wp_get_media",
    title: "List media",
    description: "List WordPress media items (images, videos, files).",
    inputSchema: {
      page: z.number().int().positive().optional(),
      per_page: z.number().int().min(1).max(100).optional(),
      search: z.string().optional(),
      media_type: z.enum(["image", "video", "audio", "application"]).optional(),
      mime_type: z.string().optional(),
      parent: z.number().int().optional(),
      orderby: z.enum(["date", "id", "title", "modified", "slug"]).optional(),
      order: z.enum(["asc", "desc"]).optional(),
      _fields: z.string().optional(),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => {
      const result = await wp.media.list(input as Parameters<typeof wp.media.list>[0]);
      return { media: result.data, total: result.total, total_pages: result.pages };
    },
  },

  {
    name: "wp_get_media_item",
    title: "Get a media item",
    description: "Get a single media item by ID.",
    inputSchema: { id: z.number().int().positive() },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => wp.media.get((input as { id: number }).id),
  },

  {
    name: "wp_upload_media_file",
    title: "Upload media from local file",
    description: "Upload a media file from an absolute local path.",
    inputSchema: {
      file_path: z.string().min(1),
      title: z.string().optional(),
      alt_text: z.string().optional(),
      caption: z.string().optional(),
      description: z.string().optional(),
      post: z.number().int().optional(),
    },
    annotations: { openWorldHint: true },
    handler: async (input) => {
      const { file_path, ...metadata } = input as {
        file_path: string;
        title?: string;
        alt_text?: string;
        caption?: string;
        description?: string;
        post?: number;
      };
      return wp.uploadMediaFromFile(file_path, metadata);
    },
  },

  {
    name: "wp_upload_media_url",
    title: "Upload media from URL",
    description: "Download a remote file and upload it to WordPress.",
    inputSchema: {
      url: z.string().url(),
      title: z.string().optional(),
      alt_text: z.string().optional(),
      caption: z.string().optional(),
      description: z.string().optional(),
      post: z.number().int().optional(),
    },
    annotations: { openWorldHint: true },
    handler: async (input) => {
      const { url, ...metadata } = input as {
        url: string;
        title?: string;
        alt_text?: string;
        caption?: string;
        description?: string;
        post?: number;
      };
      return wp.uploadMediaFromUrl(url, metadata);
    },
  },

  {
    name: "wp_update_media",
    title: "Update media metadata",
    description: "Update metadata of an existing media item.",
    inputSchema: {
      id: z.number().int().positive(),
      title: z.string().optional(),
      alt_text: z.string().optional(),
      caption: z.string().optional(),
      description: z.string().optional(),
      post: z.number().int().optional(),
    },
    annotations: { openWorldHint: true },
    handler: async (input) => {
      const { id, ...data } = input as { id: number; [k: string]: unknown };
      return wp.media.update(id, data);
    },
  },

  {
    name: "wp_delete_media",
    title: "Delete media",
    description:
      "Permanently delete a media item. WordPress does not trash media; this is irreversible.",
    inputSchema: {
      id: z.number().int().positive(),
      force: z.boolean().optional(),
    },
    annotations: { destructiveHint: true, openWorldHint: true },
    handler: async (input) => {
      const { id, force = true } = input as { id: number; force?: boolean };
      return wp.media.remove(id, force);
    },
  },
];
