import { z } from "zod";
import { WordPressClient } from "../wordpress-client.js";
import type { ToolDef } from "../types.js";

/**
 * Tools for the WP 5.6+ batch endpoint (/batch/v1).
 *
 * Notes:
 *  - GET requests are NOT supported by core; only POST/PUT/PATCH/DELETE.
 *  - Default max 25 requests per batch (filterable server-side).
 *  - Response is HTTP 207 with parallel `responses` array, same order as input.
 *  - The route being batched must declare `'allow_batch' => array('v1' => true)`.
 *    Most built-in routes do; some plugins do not yet.
 */
export const batchTools = (wp: WordPressClient): ToolDef[] => [
  {
    name: "wp_batch_options",
    title: "Batch: discover capabilities",
    description:
      "OPTIONS /batch/v1 — returns the maximum requests per batch and accepted methods.",
    inputSchema: {},
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async () => wp.batchOptions(),
  },

  {
    name: "wp_batch",
    title: "Batch: execute write operations in one round-trip",
    description:
      "POST /batch/v1 — execute multiple write operations in a single request. " +
      "GET is not supported. Use validation='require-all-validate' to abort the whole batch if any request is invalid.",
    inputSchema: {
      validation: z.enum(["normal", "require-all-validate"]).optional(),
      requests: z
        .array(
          z.object({
            method: z.enum(["POST", "PUT", "PATCH", "DELETE"]).optional(),
            path: z
              .string()
              .min(1)
              .describe(
                "Route path beginning with /, e.g. '/wp/v2/posts' or '/wp/v2/posts/123'"
              ),
            headers: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(),
            body: z.record(z.string(), z.unknown()).optional(),
          })
        )
        .min(1)
        .max(100)
        .describe("Up to ~25 by default; some sites raise the cap. Check wp_batch_options."),
    },
    annotations: { openWorldHint: true },
    handler: async (input) => {
      const { requests, validation = "normal" } = input as {
        requests: Array<{
          method?: "POST" | "PUT" | "PATCH" | "DELETE";
          path: string;
          headers?: Record<string, string | string[]>;
          body?: Record<string, unknown>;
        }>;
        validation?: "normal" | "require-all-validate";
      };
      return wp.batch(requests, validation);
    },
  },
];
