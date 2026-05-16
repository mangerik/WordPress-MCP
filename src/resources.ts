import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { WordPressClient } from "./wordpress-client.js";

/**
 * Register MCP resources so clients can attach WordPress content as context
 * without burning a tool call. URIs:
 *
 *   wp://site                  → REST root summary
 *   wp://post/{id}             → single post (rendered HTML + meta)
 *   wp://page/{id}             → single page
 *   wp://media/{id}            → media metadata + source_url
 */
export function registerResources(server: McpServer, wp: WordPressClient) {
  server.registerResource(
    "site",
    "wp://site",
    {
      title: "WordPress site info",
      description: "Site name, description, and discovered REST namespaces.",
      mimeType: "application/json",
    },
    async (uri) => {
      const data = await wp.siteInfo();
      return {
        contents: [
          { uri: uri.href, mimeType: "application/json", text: JSON.stringify(data, null, 2) },
        ],
      };
    }
  );

  server.registerResource(
    "post",
    new ResourceTemplate("wp://post/{id}", { list: undefined }),
    {
      title: "WordPress post",
      description: "Single post by ID with rendered content.",
      mimeType: "application/json",
    },
    async (uri, vars) => {
      const id = Number(vars.id);
      const data = await wp.posts.get(id, { context: "view", _embed: true });
      return {
        contents: [
          { uri: uri.href, mimeType: "application/json", text: JSON.stringify(data, null, 2) },
        ],
      };
    }
  );

  server.registerResource(
    "page",
    new ResourceTemplate("wp://page/{id}", { list: undefined }),
    {
      title: "WordPress page",
      description: "Single page by ID with rendered content.",
      mimeType: "application/json",
    },
    async (uri, vars) => {
      const id = Number(vars.id);
      const data = await wp.pages.get(id, { context: "view", _embed: true });
      return {
        contents: [
          { uri: uri.href, mimeType: "application/json", text: JSON.stringify(data, null, 2) },
        ],
      };
    }
  );

  server.registerResource(
    "media",
    new ResourceTemplate("wp://media/{id}", { list: undefined }),
    {
      title: "WordPress media item",
      description: "Single media item metadata, including source URL.",
      mimeType: "application/json",
    },
    async (uri, vars) => {
      const id = Number(vars.id);
      const data = await wp.media.get(id);
      return {
        contents: [
          { uri: uri.href, mimeType: "application/json", text: JSON.stringify(data, null, 2) },
        ],
      };
    }
  );
}
