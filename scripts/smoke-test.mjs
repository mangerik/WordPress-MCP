#!/usr/bin/env node
// Quick smoke test: spawn the built server, run MCP initialize + tools/list,
// and print the tool count + first few names. No network calls to WordPress.
import { spawn } from "node:child_process";

const child = spawn("node", ["dist/index.js"], {
  env: {
    ...process.env,
    WP_URL: "https://example.com",
    WP_USERNAME: "smoketest",
    WP_APP_PASSWORD: "xxxx xxxx xxxx xxxx xxxx xxxx",
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
      // ignore non-JSON lines
    }
  }
});

function send(req) {
  child.stdin.write(JSON.stringify(req) + "\n");
}

function waitFor(id, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
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
}

try {
  send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "smoke", version: "0" },
    },
  });
  const init = await waitFor(1);
  console.log("server:", init.result?.serverInfo);
  console.log("capabilities:", Object.keys(init.result?.capabilities ?? {}));

  send({ jsonrpc: "2.0", method: "notifications/initialized", params: {} });

  send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  const tools = await waitFor(2);
  const list = tools.result?.tools ?? [];
  console.log(`tools registered: ${list.length}`);
  console.log("first 5:", list.slice(0, 5).map((t) => t.name));

  send({ jsonrpc: "2.0", id: 3, method: "resources/list", params: {} });
  const res = await waitFor(3);
  console.log("resources:", (res.result?.resources ?? []).map((r) => r.uri));

  send({ jsonrpc: "2.0", id: 4, method: "resources/templates/list", params: {} });
  const tpl = await waitFor(4);
  console.log(
    "resource templates:",
    (tpl.result?.resourceTemplates ?? []).map((r) => r.uriTemplate)
  );

  send({ jsonrpc: "2.0", id: 5, method: "prompts/list", params: {} });
  const prompts = await waitFor(5);
  console.log("prompts:", (prompts.result?.prompts ?? []).map((p) => p.name));

  // Verify a tool's inputSchema is JSON Schema, not a zod object.
  const sample = list.find((t) => t.name === "wp_get_post");
  console.log("wp_get_post schema keys:", Object.keys(sample?.inputSchema ?? {}));
  console.log(
    "wp_get_post properties:",
    Object.keys(sample?.inputSchema?.properties ?? {})
  );
} finally {
  child.kill();
}
