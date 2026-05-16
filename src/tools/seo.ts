import { z } from "zod";
import { WordPressClient } from "../wordpress-client.js";
import type { ToolDef } from "../types.js";

/**
 * SEO tools for Yoast SEO and Rank Math.
 *
 * Both plugins primarily store SEO data in WordPress post meta. The keys
 * differ; we expose them through a uniform getter/setter that targets the
 * right plugin based on a `plugin` argument.
 *
 * Yoast also ships REST endpoints under `/yoast/v1/*` for SERP previews,
 * which we wrap as dedicated tools.
 */

// ─── Meta key maps ────────────────────────────────────────────────────────

const YOAST_KEYS = {
  title: "_yoast_wpseo_title",
  description: "_yoast_wpseo_metadesc",
  focus_keyword: "_yoast_wpseo_focuskw",
  canonical: "_yoast_wpseo_canonical",
  noindex: "_yoast_wpseo_meta-robots-noindex", // "0" | "1" | "2"
  nofollow: "_yoast_wpseo_meta-robots-nofollow", // "0" | "1"
  og_title: "_yoast_wpseo_opengraph-title",
  og_description: "_yoast_wpseo_opengraph-description",
  og_image: "_yoast_wpseo_opengraph-image",
  twitter_title: "_yoast_wpseo_twitter-title",
  twitter_description: "_yoast_wpseo_twitter-description",
  twitter_image: "_yoast_wpseo_twitter-image",
  schema_type: "_yoast_wpseo_schema_page_type",
} as const;

const RANK_MATH_KEYS = {
  title: "rank_math_title",
  description: "rank_math_description",
  focus_keyword: "rank_math_focus_keyword",
  canonical: "rank_math_canonical_url",
  robots: "rank_math_robots", // serialized array, e.g. ["index","follow"]
  og_title: "rank_math_facebook_title",
  og_description: "rank_math_facebook_description",
  og_image: "rank_math_facebook_image",
  twitter_title: "rank_math_twitter_title",
  twitter_description: "rank_math_twitter_description",
  twitter_image: "rank_math_twitter_image",
  schema_type: "rank_math_rich_snippet",
} as const;

const PLUGIN = z.enum(["yoast", "rank_math"]);
type PluginKey = z.infer<typeof PLUGIN>;

const POST_TYPES = ["post", "page"] as const;
const postTypeEnum = z.enum(POST_TYPES);

const seoFields = {
  title: z.string().optional().describe("SEO title tag"),
  description: z.string().optional().describe("Meta description"),
  focus_keyword: z.string().optional(),
  canonical: z.string().url().optional(),
  noindex: z.boolean().optional(),
  nofollow: z.boolean().optional(),
  og_title: z.string().optional(),
  og_description: z.string().optional(),
  og_image: z.string().url().optional(),
  twitter_title: z.string().optional(),
  twitter_description: z.string().optional(),
  twitter_image: z.string().url().optional(),
};

function pickKeys(plugin: PluginKey) {
  return plugin === "yoast" ? YOAST_KEYS : RANK_MATH_KEYS;
}

/**
 * Translate friendly SEO fields to plugin-specific meta key/values.
 * Yoast uses string flags, Rank Math uses serialized robots array.
 */
function buildMetaPayload(
  plugin: PluginKey,
  input: Record<string, unknown>
): Record<string, unknown> {
  const keys = pickKeys(plugin);
  const meta: Record<string, unknown> = {};
  const set = (k: string | undefined, v: unknown) => {
    if (k && v !== undefined && v !== null) meta[k] = v;
  };

  set(keys.title, input.title);
  set(keys.description, input.description);
  set(keys.focus_keyword, input.focus_keyword);
  set(keys.canonical, input.canonical);
  set(keys.og_title, input.og_title);
  set(keys.og_description, input.og_description);
  set(keys.og_image, input.og_image);
  set(keys.twitter_title, input.twitter_title);
  set(keys.twitter_description, input.twitter_description);
  set(keys.twitter_image, input.twitter_image);

  if (plugin === "yoast") {
    if (input.noindex !== undefined) {
      // Yoast: "0" default, "1" noindex, "2" index (force)
      meta[YOAST_KEYS.noindex] = input.noindex ? "1" : "2";
    }
    if (input.nofollow !== undefined) {
      meta[YOAST_KEYS.nofollow] = input.nofollow ? "1" : "0";
    }
  } else {
    // Rank Math stores robots as a serialized array of flags.
    const flags: string[] = [];
    if (input.noindex !== undefined) flags.push(input.noindex ? "noindex" : "index");
    if (input.nofollow !== undefined)
      flags.push(input.nofollow ? "nofollow" : "follow");
    if (flags.length) meta[RANK_MATH_KEYS.robots] = flags;
  }

  return meta;
}

/** Reverse of buildMetaPayload: read raw meta back into friendly fields. */
function readMetaPayload(
  plugin: PluginKey,
  meta: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!meta) return {};
  const keys = pickKeys(plugin);
  const out: Record<string, unknown> = {};
  const get = (k: string | undefined) => (k ? meta[k] : undefined);

  out.title = get(keys.title);
  out.description = get(keys.description);
  out.focus_keyword = get(keys.focus_keyword);
  out.canonical = get(keys.canonical);
  out.og_title = get(keys.og_title);
  out.og_description = get(keys.og_description);
  out.og_image = get(keys.og_image);
  out.twitter_title = get(keys.twitter_title);
  out.twitter_description = get(keys.twitter_description);
  out.twitter_image = get(keys.twitter_image);

  if (plugin === "yoast") {
    const ni = get(YOAST_KEYS.noindex);
    out.noindex = ni === "1" ? true : ni === "2" ? false : undefined;
    const nf = get(YOAST_KEYS.nofollow);
    out.nofollow = nf === "1" ? true : nf === "0" ? false : undefined;
  } else {
    const robots = get(RANK_MATH_KEYS.robots);
    if (Array.isArray(robots)) {
      out.noindex = robots.includes("noindex") || undefined;
      out.nofollow = robots.includes("nofollow") || undefined;
    }
  }
  return out;
}

function routeFor(postType: string) {
  if (postType === "post") return "wp/v2/posts";
  if (postType === "page") return "wp/v2/pages";
  return `wp/v2/${postType}`;
}

export const seoTools = (wp: WordPressClient): ToolDef[] => [
  // ── Get/set SEO meta on a post or page ──────────────────────────────────
  {
    name: "seo_get_meta",
    title: "Get SEO meta (Yoast / Rank Math)",
    description:
      "Read SEO meta (title, description, focus keyword, robots, OG, Twitter) " +
      "for a post or page. Specify which SEO plugin you use.",
    inputSchema: {
      plugin: PLUGIN,
      post_type: postTypeEnum.default("post"),
      id: z.number().int().positive(),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => {
      const { plugin, post_type, id } = input as {
        plugin: PluginKey;
        post_type: (typeof POST_TYPES)[number];
        id: number;
      };
      const route = routeFor(post_type);
      const data = (await wp.get(route, id, { context: "edit", _fields: "id,slug,meta" })) as
        | { id: number; slug: string; meta: Record<string, unknown> }
        | undefined;
      return {
        plugin,
        post_id: data?.id,
        slug: data?.slug,
        seo: readMetaPayload(plugin, data?.meta),
        raw_meta: data?.meta,
      };
    },
  },

  {
    name: "seo_set_meta",
    title: "Set SEO meta (Yoast / Rank Math)",
    description:
      "Write SEO meta (title, description, focus keyword, robots, OG, Twitter) " +
      "to a post or page via the chosen SEO plugin's meta keys. " +
      "NOTE: the meta keys must be exposed via REST (Yoast does this automatically; " +
      "Rank Math may require enabling REST API in plugin settings).",
    inputSchema: {
      plugin: PLUGIN,
      post_type: postTypeEnum.default("post"),
      id: z.number().int().positive(),
      ...seoFields,
    },
    annotations: { openWorldHint: true },
    handler: async (input) => {
      const { plugin, post_type, id, ...fields } = input as {
        plugin: PluginKey;
        post_type: (typeof POST_TYPES)[number];
        id: number;
        [k: string]: unknown;
      };
      const meta = buildMetaPayload(plugin, fields);
      if (Object.keys(meta).length === 0) {
        return { updated: false, reason: "no SEO fields provided" };
      }
      const route = routeFor(post_type);
      const result = (await wp.update(route, id, { meta })) as {
        id: number;
        meta?: Record<string, unknown>;
      };
      return {
        plugin,
        post_id: result.id,
        applied_keys: Object.keys(meta),
        seo: readMetaPayload(plugin, result.meta),
      };
    },
  },

  // ── Yoast-specific endpoints ────────────────────────────────────────────
  {
    name: "yoast_get_head",
    title: "Yoast: get rendered SEO head HTML",
    description:
      "Use Yoast's /yoast/v1/get_head endpoint to fetch the rendered <head> HTML " +
      "for a given URL — useful for previewing what search engines will see.",
    inputSchema: {
      url: z.string().url(),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => {
      const { url } = input as { url: string };
      const r = await wp.list<unknown>("yoast/v1/get_head", { url });
      return { yoast_head: r.data };
    },
  },
  {
    name: "yoast_indexable_for_post",
    title: "Yoast: get post 'indexable' (computed SEO snapshot)",
    description:
      "Read the Yoast indexable record (title, description, canonical, breadcrumbs) " +
      "for a post via /yoast/v1/indexable.",
    inputSchema: { id: z.number().int().positive() },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => {
      const { id } = input as { id: number };
      // Yoast exposes /yoast/v1/indexable?object_id=ID&object_type=post
      const r = await wp.list<unknown>("yoast/v1/indexable", {
        object_id: id,
        object_type: "post",
      });
      return { indexable: r.data };
    },
  },

  // ── Rank Math: redirections (very common use case) ─────────────────────
  {
    name: "rankmath_list_redirections",
    title: "Rank Math: list redirections",
    description:
      "List Rank Math redirection rules (requires Rank Math Pro REST API enabled).",
    inputSchema: {
      page: z.number().int().positive().optional(),
      per_page: z.number().int().min(1).max(100).optional(),
      search: z.string().optional(),
      status: z.enum(["any", "active", "inactive"]).optional(),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => {
      const r = await wp.list("rankmath/v1/rm/redirections", input);
      return { redirections: r.data, total: r.total };
    },
  },
  {
    name: "rankmath_create_redirection",
    title: "Rank Math: create redirection",
    description: "Create a redirection rule.",
    inputSchema: {
      sources: z
        .array(
          z.object({
            pattern: z.string(),
            comparison: z.enum(["exact", "contains", "start", "end", "regex"]).optional(),
            ignore: z.array(z.enum(["case", "query"])).optional(),
          })
        )
        .min(1),
      url_to: z.string(),
      header_code: z.enum(["301", "302", "307", "410", "451"]).optional(),
      status: z.enum(["active", "inactive"]).optional(),
    },
    annotations: { openWorldHint: true },
    handler: async (input) =>
      wp.create("rankmath/v1/rm/redirections", input as Record<string, unknown>),
  },
];
