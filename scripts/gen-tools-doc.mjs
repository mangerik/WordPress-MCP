#!/usr/bin/env node
// Auto-generate docs/TOOLS.md by introspecting the running MCP server.
// Boots dist/index.js with stub credentials, calls tools/list, and renders
// a markdown reference grouped by feature area.
import { spawn } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const child = spawn("node", ["dist/index.js"], {
  env: {
    ...process.env,
    // Run in JWT mode so jwt diagnostics tools are included in the listing.
    WP_AUTH_MODE: "jwt",
    WP_URL: "https://example.com",
    WP_USERNAME: "doc-gen",
    WP_JWT_TOKEN: "doc-gen-stub-token-1234567890",
  },
  stdio: ["pipe", "pipe", "inherit"],
});

let buf = "";
const replies = new Map();

child.stdout.on("data", (chunk) => {
  buf += chunk.toString("utf8");
  let idx;
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id != null) replies.set(msg.id, msg);
    } catch {
      /* ignore */
    }
  }
});

const send = (req) => child.stdin.write(JSON.stringify(req) + "\n");
const waitFor = (id, timeoutMs = 5000) =>
  new Promise((resolve, reject) => {
    const start = Date.now();
    const t = setInterval(() => {
      if (replies.has(id)) {
        clearInterval(t);
        resolve(replies.get(id));
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(t);
        reject(new Error(`timeout waiting for id ${id}`));
      }
    }, 25);
  });

// ─── Group tools by prefix ────────────────────────────────────────────────
const GROUPS = [
  { prefix: "wp_site_info|wp_get_settings|wp_update_settings|wp_get_post_types|wp_get_taxonomies|wp_search", title: "Site & discovery", emoji: "🏠" },
  { prefix: "wp_get_posts|wp_get_post|wp_create_post|wp_update_post|wp_delete_post|wp_get_post_revisions", title: "Posts", emoji: "📝" },
  { prefix: "wp_get_pages|wp_get_page|wp_create_page|wp_update_page|wp_delete_page", title: "Pages", emoji: "📄" },
  { prefix: "wp_get_media|wp_get_media_item|wp_upload_media_file|wp_upload_media_url|wp_update_media|wp_delete_media", title: "Media", emoji: "🖼️" },
  { prefix: "wp_get_comments|wp_get_comment|wp_create_comment|wp_update_comment|wp_delete_comment", title: "Comments", emoji: "💬" },
  { prefix: "wp_get_categories|wp_get_category|wp_create_category|wp_update_category|wp_delete_category|wp_get_tags|wp_get_tag|wp_create_tag|wp_update_tag|wp_delete_tag", title: "Taxonomies (categories & tags)", emoji: "🏷️" },
  { prefix: "wp_get_users|wp_get_user|wp_get_current_user|wp_create_user|wp_update_user|wp_delete_user", title: "Users", emoji: "👤" },
  { prefix: "wp_list_items|wp_get_item|wp_create_item|wp_update_item|wp_delete_item", title: "Generic CPT / plugin namespaces", emoji: "🧰" },
  { prefix: "wc_", title: "WooCommerce", emoji: "🛒" },
  { prefix: "seo_|yoast_|rankmath_", title: "SEO (Yoast & Rank Math)", emoji: "📈" },
  { prefix: "wp_list_templates|wp_get_template|wp_update_template|wp_list_template_parts|wp_get_template_part|wp_update_template_part|wp_list_block_patterns|wp_list_block_pattern_categories|wp_list_block_types|wp_get_global_styles|wp_list_menus|wp_list_menu_items", title: "Block themes (WP 5.9+)", emoji: "🧱" },
  { prefix: "ms_", title: "Multisite", emoji: "🌐" },
  { prefix: "wp_batch", title: "Batch operations", emoji: "📦" },
  { prefix: "wp_jwt_", title: "JWT diagnostics", emoji: "🔐" },
];

function groupOf(name) {
  for (const g of GROUPS) {
    const re = new RegExp(`^(${g.prefix})`);
    if (re.test(name)) return g;
  }
  return { title: "Other", emoji: "🔧" };
}

function renderType(schema) {
  if (!schema) return "—";
  if (schema.type === "string") {
    if (schema.enum) return schema.enum.map((v) => `\`"${v}"\``).join(" \\| ");
    if (schema.format) return `string (${schema.format})`;
    return "string";
  }
  if (schema.type === "integer" || schema.type === "number") return "number";
  if (schema.type === "boolean") return "boolean";
  if (schema.type === "array") return `${renderType(schema.items)}[]`;
  if (schema.type === "object") return "object";
  if (Array.isArray(schema.type)) return schema.type.join(" \\| ");
  if (schema.anyOf) return schema.anyOf.map(renderType).join(" \\| ");
  return "unknown";
}

function renderArgs(schema) {
  const props = schema?.properties ?? {};
  const required = new Set(schema?.required ?? []);
  const keys = Object.keys(props);
  if (keys.length === 0) return "_(no arguments)_";
  const rows = keys.map((k) => {
    const p = props[k];
    const req = required.has(k) ? "✓" : "";
    const desc = (p.description ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
    return `| \`${k}\` | ${renderType(p)} | ${req} | ${desc} |`;
  });
  return [
    "| Argument | Type | Required | Description |",
    "|---|---|---|---|",
    ...rows,
  ].join("\n");
}

function renderAnnotations(a) {
  if (!a) return "";
  const flags = [];
  if (a.readOnlyHint) flags.push("read-only");
  if (a.idempotentHint) flags.push("idempotent");
  if (a.destructiveHint) flags.push("⚠️ destructive");
  if (a.openWorldHint) flags.push("network call");
  return flags.length ? `_Hints: ${flags.join(", ")}_` : "";
}

try {
  send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "doc-gen", version: "0" },
    },
  });
  await waitFor(1);
  send({ jsonrpc: "2.0", method: "notifications/initialized", params: {} });

  send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  const r = await waitFor(2);
  const tools = r.result?.tools ?? [];

  // Sort tools into groups (preserve original group order).
  const grouped = new Map(GROUPS.map((g) => [g.title, []]));
  grouped.set("Other", []);
  for (const t of tools) grouped.get(groupOf(t.name).title).push(t);

  const lines = [];
  lines.push("# Tool Reference");
  lines.push("");
  lines.push(
    "_This file is auto-generated by `scripts/gen-tools-doc.mjs`. " +
      `Last regenerated: ${tools.length} tools._`
  );
  lines.push("");
  lines.push(
    "Each tool ships a JSON Schema; clients (Claude Desktop, Kiro, etc.) read it automatically. " +
      "This document is a human-readable summary."
  );
  lines.push("");
  lines.push("## Table of contents");
  lines.push("");
  for (const g of [...GROUPS, { title: "Other" }]) {
    const arr = grouped.get(g.title) ?? [];
    if (arr.length === 0) continue;
    const anchor = g.title.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/ +/g, "-");
    lines.push(`- [${g.emoji ?? "🔧"} ${g.title}](#${anchor}) (${arr.length})`);
  }
  lines.push("");

  for (const g of [...GROUPS, { title: "Other", emoji: "🔧" }]) {
    const arr = grouped.get(g.title) ?? [];
    if (arr.length === 0) continue;
    lines.push(`## ${g.emoji ?? "🔧"} ${g.title}`);
    lines.push("");
    for (const t of arr) {
      lines.push(`### \`${t.name}\``);
      if (t.title && t.title !== t.name) lines.push(`**${t.title}**`);
      lines.push("");
      if (t.description) lines.push(t.description);
      lines.push("");
      const ann = renderAnnotations(t.annotations);
      if (ann) {
        lines.push(ann);
        lines.push("");
      }
      lines.push(renderArgs(t.inputSchema));
      lines.push("");
    }
  }

  const out = "docs/TOOLS.md";
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, lines.join("\n"), "utf8");
  console.log(`Wrote ${out} (${tools.length} tools, ${lines.length} lines)`);
} finally {
  child.kill();
}
