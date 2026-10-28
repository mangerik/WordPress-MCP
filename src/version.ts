import { createRequire } from "node:module";

/**
 * Single source of truth for the server version: package.json.
 * Resolves to the package root from both `src/` (tsx) and `dist/` (build).
 */
const require = createRequire(import.meta.url);

export const VERSION: string = (require("../package.json") as { version: string }).version;
