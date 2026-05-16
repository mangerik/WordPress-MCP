#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { loadConfig } from "./config.js";
import { WordPressClient, WPError } from "./wordpress-client.js";
import type { ToolDef } from "./types.js";

import { postTools } from "./tools/posts.js";
import { pageTools } from "./tools/pages.js";
import { mediaTools } from "./tools/media.js";
import { commentTools } from "./tools/comments.js";
import { taxonomyTools } from "./tools/taxonomy.js";
import { userTools } from "./tools/users.js";
import { siteTools } from "./tools/site.js";
import { cptTools } from "./tools/cpt.js";
import { woocommerceTools } from "./tools/woocommerce.js";
import { seoTools } from "./tools/seo.js";
import { blockTools } from "./tools/blocks.js";
import { multisiteTools } from "./tools/multisite.js";
import { batchTools } from "./tools/batch.js";
import { jwtTools } from "./tools/jwt.js";

import { registerResources } from "./resources.js";
import { registerPrompts } from "./prompts.js";

const NAME = "wordpress-mcp";
const VERSION = "1.0.0";

/**
 * Wrap a tool handler so its return value becomes a proper `CallToolResult`
 * and any thrown error becomes an `isError: true` result the LLM can see.
 *
 * Important for stdio: never write to stdout outside the MCP framing — all
 * logs go to stderr.
 */
function wrap(tool: ToolDef): (input: Record<string, unknown>) => Promise<CallToolResult> {
  return async (input) => {
    try {
      const data = await tool.handler(input);
      const text =
        typeof data === "string" ? data : JSON.stringify(data, null, 2);
      const result: CallToolResult = {
        content: [{ type: "text", text }],
      };
      // Attach structured output when it's a JSON-compatible object.
      if (data && typeof data === "object") {
        (result as { structuredContent?: unknown }).structuredContent = data;
      }
      return result;
    } catch (err) {
      const message = formatError(err);
      // Log full error to stderr for debugging without breaking stdio framing.
      console.error(`[${tool.name}]`, err);
      return {
        isError: true,
        content: [{ type: "text", text: message }],
      };
    }
  };
}

function formatError(err: unknown): string {
  if (err instanceof WPError) {
    const parts = [
      `WordPress error: ${err.message}`,
      `code: ${err.code}`,
      `status: ${err.status}`,
    ];
    if (err.details && typeof err.details === "object") {
      parts.push(`details: ${JSON.stringify(err.details)}`);
    }
    return parts.join(" | ");
  }
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return `Unknown error: ${String(err)}`;
}

async function main() {
  const config = loadConfig();

  const wp = new WordPressClient({
    baseUrl: config.WP_URL,
    authMode: config.WP_AUTH_MODE,
    username: config.WP_USERNAME,
    appPassword: config.WP_APP_PASSWORD,
    password: config.WP_PASSWORD,
    jwtToken: config.WP_JWT_TOKEN,
    jwtNamespace: config.WP_JWT_NAMESPACE,
    timeoutMs: config.WP_TIMEOUT_MS,
    maxRetries: config.WP_MAX_RETRIES,
    verifySsl: config.WP_VERIFY_SSL,
    userAgent: config.WP_USER_AGENT,
    wcConsumerKey: config.WC_CONSUMER_KEY,
    wcConsumerSecret: config.WC_CONSUMER_SECRET,
  });

  // Bootstrap JWT if needed (no-op for application_password mode).
  await wp.ensureJwt();

  const server = new McpServer(
    { name: NAME, version: VERSION },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
        logging: {},
      },
      instructions:
        "WordPress MCP server. Authenticated via Application Password. " +
        "Discover the site shape with wp_site_info / wp_get_post_types / wp_get_taxonomies " +
        "before performing CRUD on custom content. Destructive tools (delete, force=true) " +
        "are irreversible — confirm with the user first.",
    }
  );

  // Collect all tools from feature modules.
  const tools: ToolDef[] = [
    ...siteTools(wp),
    ...postTools(wp),
    ...pageTools(wp),
    ...mediaTools(wp),
    ...commentTools(wp),
    ...taxonomyTools(wp),
    ...userTools(wp),
    ...cptTools(wp),
    ...woocommerceTools(wp),
    ...seoTools(wp),
    ...blockTools(wp),
    ...multisiteTools(wp),
    ...batchTools(wp),
    ...(config.WP_AUTH_MODE === "jwt" ? jwtTools(wp) : []),
  ];

  // Sanity check: tool names must be unique.
  const seen = new Set<string>();
  for (const t of tools) {
    if (seen.has(t.name)) throw new Error(`Duplicate tool name: ${t.name}`);
    seen.add(t.name);
  }

  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
      },
      wrap(tool)
    );
  }

  registerResources(server, wp);
  registerPrompts(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `[${NAME}] connected · ${tools.length} tools · auth: ${config.WP_AUTH_MODE} · target: ${config.WP_URL}`
  );
}

main().catch((err) => {
  console.error(`[${NAME}] fatal:`, err instanceof Error ? err.message : err);
  process.exit(1);
});
