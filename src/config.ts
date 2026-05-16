import { z } from "zod";

/**
 * Server configuration loaded from environment variables.
 * Validated with zod so we fail fast at startup.
 */
const ConfigSchema = z
  .object({
    WP_URL: z
      .string()
      .url()
      .describe("Base URL of the WordPress site, e.g. https://example.com"),

    WP_AUTH_MODE: z
      .enum(["application_password", "jwt"])
      .default("application_password"),

    // ── Application Password mode ───────────────────────────────────────
    WP_USERNAME: z.string().min(1).optional(),
    WP_APP_PASSWORD: z.string().min(1).optional(),

    // ── JWT mode (Tmeister "JWT Authentication for WP REST API") ────────
    // Either supply username + password and we'll fetch a token at startup,
    // or supply WP_JWT_TOKEN directly (e.g. issued by another auth plugin).
    WP_PASSWORD: z.string().min(1).optional(),
    WP_JWT_TOKEN: z.string().min(10).optional(),
    WP_JWT_NAMESPACE: z.string().default("jwt-auth/v1"),

    // ── Common ──────────────────────────────────────────────────────────
    WP_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
    WP_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(3),
    WP_VERIFY_SSL: z
      .union([z.literal("true"), z.literal("false")])
      .default("true")
      .transform((v) => v === "true"),
    WP_USER_AGENT: z.string().default("WordPress-MCP-Server/1.0"),

    // ── WooCommerce (optional) ──────────────────────────────────────────
    WC_CONSUMER_KEY: z.string().optional(),
    WC_CONSUMER_SECRET: z.string().optional(),
  })
  .superRefine((c, ctx) => {
    if (c.WP_AUTH_MODE === "application_password") {
      if (!c.WP_USERNAME)
        ctx.addIssue({ code: "custom", path: ["WP_USERNAME"], message: "Required for application_password mode" });
      if (!c.WP_APP_PASSWORD)
        ctx.addIssue({ code: "custom", path: ["WP_APP_PASSWORD"], message: "Required for application_password mode" });
    }
    if (c.WP_AUTH_MODE === "jwt") {
      const hasToken = !!c.WP_JWT_TOKEN;
      const hasUserPass = !!c.WP_USERNAME && !!c.WP_PASSWORD;
      if (!hasToken && !hasUserPass) {
        ctx.addIssue({
          code: "custom",
          path: ["WP_JWT_TOKEN"],
          message:
            "JWT mode requires either WP_JWT_TOKEN, or WP_USERNAME + WP_PASSWORD to obtain a token",
        });
      }
    }
  });

export type ServerConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid configuration. Check your environment variables:\n${issues}\n\n` +
        `Required (application_password mode, default):\n` +
        `  WP_URL            (e.g. https://example.com)\n` +
        `  WP_USERNAME       (your WordPress username)\n` +
        `  WP_APP_PASSWORD   (Application Password from WP profile)\n\n` +
        `Required (jwt mode):\n` +
        `  WP_AUTH_MODE=jwt\n` +
        `  WP_URL\n` +
        `  Either:\n` +
        `    WP_USERNAME + WP_PASSWORD          (server fetches token)\n` +
        `  or:\n` +
        `    WP_JWT_TOKEN                       (pre-issued token)\n` +
        `  WP_JWT_NAMESPACE  (default jwt-auth/v1; change if your plugin differs)\n\n` +
        `Optional:\n` +
        `  WP_TIMEOUT_MS     (default 30000)\n` +
        `  WP_MAX_RETRIES    (default 3)\n` +
        `  WP_VERIFY_SSL     (default true)\n` +
        `  WP_USER_AGENT     (default WordPress-MCP-Server/1.0)\n` +
        `  WC_CONSUMER_KEY   (optional, WooCommerce consumer key)\n` +
        `  WC_CONSUMER_SECRET(optional, WooCommerce consumer secret)`
    );
  }
  return parsed.data;
}
