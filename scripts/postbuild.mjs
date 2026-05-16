#!/usr/bin/env node
// After tsc emits dist/, mark the entry point executable so the `bin` field
// works when the package is installed globally or run via `npx`.
import { chmod } from "node:fs/promises";

const target = "dist/index.js";
try {
  await chmod(target, 0o755);
  console.log(`postbuild: chmod 755 ${target}`);
} catch (err) {
  console.error(`postbuild: failed to chmod ${target}:`, err.message);
  process.exit(1);
}
