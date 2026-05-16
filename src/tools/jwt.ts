import { WordPressClient } from "../wordpress-client.js";
import type { ToolDef } from "../types.js";

/**
 * JWT auth helper tools (only useful when WP_AUTH_MODE=jwt).
 * Most users won't need to call these directly — the server fetches a token
 * automatically at startup. They're handy for diagnostics.
 */
export const jwtTools = (wp: WordPressClient): ToolDef[] => [
  {
    name: "wp_jwt_validate",
    title: "JWT: validate current token",
    description:
      "POST /jwt-auth/v1/token/validate — confirms the JWT in use is valid. " +
      "Only useful in JWT auth mode.",
    inputSchema: {},
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async () => wp.validateJwt(),
  },
];
