import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Reusable prompt templates that turn common WordPress workflows into one-click
 * actions for the LLM client.
 */
export function registerPrompts(server: McpServer) {
  server.registerPrompt(
    "summarize_post",
    {
      title: "Summarize a post",
      description: "Generate a concise summary of a WordPress post.",
      argsSchema: {
        post_id: z.string().describe("Post ID to summarize"),
        length: z.enum(["short", "medium", "long"]).optional(),
      },
    },
    ({ post_id, length = "medium" }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Read the post at resource wp://post/${post_id} and write a ${length} summary. ` +
              `Cover: main thesis, key points, target audience. Use plain prose.`,
          },
        },
      ],
    })
  );

  server.registerPrompt(
    "seo_rewrite",
    {
      title: "SEO rewrite",
      description: "Rewrite a post for SEO without changing the substance.",
      argsSchema: {
        post_id: z.string(),
        primary_keyword: z.string(),
        target_audience: z.string().optional(),
      },
    },
    ({ post_id, primary_keyword, target_audience }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Rewrite the post at resource wp://post/${post_id} for SEO.\n` +
              `Primary keyword: "${primary_keyword}".\n` +
              (target_audience ? `Target audience: ${target_audience}.\n` : "") +
              `Constraints:\n` +
              `- Preserve facts and intent.\n` +
              `- Use the keyword in title, first paragraph, and one H2.\n` +
              `- Add a meta description ≤ 155 chars.\n` +
              `- Output JSON: { title, content (HTML), excerpt, meta_description, suggested_slug }.\n` +
              `Then call wp_update_post to apply the changes (status stays the same).`,
          },
        },
      ],
    })
  );

  server.registerPrompt(
    "translate_page",
    {
      title: "Translate a page",
      description: "Translate a page into another language while preserving HTML structure.",
      argsSchema: {
        page_id: z.string(),
        target_language: z.string().describe("e.g. 'Indonesian', 'fr-FR'"),
        create_new: z
          .enum(["true", "false"])
          .optional()
          .describe("If 'true', create a new page instead of updating in place."),
      },
    },
    ({ page_id, target_language, create_new }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Translate the page at resource wp://page/${page_id} into ${target_language}. ` +
              `Preserve all HTML tags, attributes, and shortcodes. Translate alt text and titles. ` +
              (create_new === "true"
                ? `Then call wp_create_page (status=draft) with the translated content.`
                : `Then call wp_update_page on the same id with the translated content.`),
          },
        },
      ],
    })
  );

  server.registerPrompt(
    "draft_post",
    {
      title: "Draft a new post",
      description: "Outline and draft a new blog post in WordPress (status=draft).",
      argsSchema: {
        topic: z.string(),
        tone: z.string().optional(),
        word_count: z.string().optional(),
      },
    },
    ({ topic, tone = "informative", word_count = "800" }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Draft a WordPress post about: ${topic}.\n` +
              `Tone: ${tone}. Target length: ~${word_count} words.\n` +
              `Steps:\n` +
              `1. Use wp_get_categories and wp_get_tags to find relevant taxonomies.\n` +
              `2. Produce title, excerpt, slug, body (HTML with H2/H3 + paragraphs).\n` +
              `3. Call wp_create_post with status=draft. Return the new post id.`,
          },
        },
      ],
    })
  );
}
