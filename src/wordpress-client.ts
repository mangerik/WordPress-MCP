import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import https from "node:https";
import FormData from "form-data";
import { readFileSync } from "node:fs";
import { basename } from "node:path";

export interface WordPressConfig {
  baseUrl: string;
  /** Auth mode. Defaults to "application_password". */
  authMode?: "application_password" | "jwt";
  /** WP username (required for application_password and JWT bootstrap). */
  username?: string;
  /** Application password (application_password mode). */
  appPassword?: string;
  /** WP password (jwt mode bootstrap). */
  password?: string;
  /** Pre-issued JWT (skip token fetch). */
  jwtToken?: string;
  /** REST namespace for the JWT plugin. Default 'jwt-auth/v1'. */
  jwtNamespace?: string;
  timeoutMs?: number;
  maxRetries?: number;
  verifySsl?: boolean;
  userAgent?: string;
  /** Optional WooCommerce consumer key for /wc/* and /wc-analytics/* routes. */
  wcConsumerKey?: string;
  /** Optional WooCommerce consumer secret. */
  wcConsumerSecret?: string;
}

/**
 * Common WP REST query parameters. Anything not covered here can be passed
 * via the `extra` field of higher-level tool wrappers.
 */
export interface WPQueryParams {
  page?: number;
  per_page?: number;
  search?: string;
  orderby?: string;
  order?: "asc" | "desc";
  status?: string;
  categories?: number[] | string;
  tags?: number[] | string;
  author?: number | number[];
  after?: string;
  before?: string;
  slug?: string | string[];
  include?: number[];
  exclude?: number[];
  parent?: number | number[];
  context?: "view" | "embed" | "edit";
  /** Comma-separated list of fields to keep in the response (saves tokens). */
  _fields?: string;
  /** Embed related entities like author, featured_media. */
  _embed?: boolean | string;
  [key: string]: unknown;
}

export interface WPListResult<T> {
  data: T[];
  total: number;
  pages: number;
}

const RETRY_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

export class WordPressClient {
  readonly baseUrl: string;
  private readonly client: AxiosInstance;
  private readonly maxRetries: number;
  private readonly userAgent: string;
  private readonly wcKey?: string;
  private readonly wcSecret?: string;
  private readonly authMode: "application_password" | "jwt";
  private readonly jwtNamespace: string;
  private readonly username?: string;
  private readonly password?: string;
  private jwtToken?: string;

  constructor(config: WordPressConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.maxRetries = config.maxRetries ?? 3;
    this.userAgent = config.userAgent ?? "WordPress-MCP-Server/1.0";
    this.wcKey = config.wcConsumerKey;
    this.wcSecret = config.wcConsumerSecret;
    this.authMode = config.authMode ?? "application_password";
    this.jwtNamespace = (config.jwtNamespace ?? "jwt-auth/v1").replace(/^\/|\/$/g, "");
    this.username = config.username;
    this.password = config.password;
    this.jwtToken = config.jwtToken;

    let authHeader: string | undefined;
    if (this.authMode === "application_password") {
      if (!config.username || !config.appPassword) {
        throw new Error(
          "application_password mode requires both username and appPassword"
        );
      }
      const token = Buffer.from(
        `${config.username}:${config.appPassword}`
      ).toString("base64");
      authHeader = `Basic ${token}`;
    } else if (this.jwtToken) {
      authHeader = `Bearer ${this.jwtToken}`;
    }
    // If JWT mode without a pre-issued token, the header is set lazily
    // after `ensureJwt()` runs.

    this.client = axios.create({
      baseURL: `${this.baseUrl}/wp-json`,
      headers: {
        ...(authHeader ? { Authorization: authHeader } : {}),
        "User-Agent": this.userAgent,
        Accept: "application/json",
      },
      timeout: config.timeoutMs ?? 30_000,
      httpsAgent:
        config.verifySsl === false
          ? new https.Agent({ rejectUnauthorized: false })
          : undefined,
      // Don't throw on 4xx — we map errors ourselves for clearer messages.
      validateStatus: () => true,
    });
  }

  /**
   * Ensure a usable JWT is loaded. Called once at startup (or on demand)
   * by callers in JWT mode without a pre-issued token.
   */
  async ensureJwt(): Promise<void> {
    if (this.authMode !== "jwt") return;
    if (this.jwtToken) {
      this.client.defaults.headers["Authorization"] = `Bearer ${this.jwtToken}`;
      return;
    }
    if (!this.username || !this.password) {
      throw new WPError(
        "JWT mode without pre-issued token requires username + password",
        { status: 0, code: "jwt_missing_credentials" }
      );
    }
    // Fetch token. We deliberately don't go through this.request() here
    // because that path would try to attach Authorization.
    const url = `${this.baseUrl}/wp-json/${this.jwtNamespace}/token`;
    const res = await axios.post(
      url,
      { username: this.username, password: this.password },
      {
        timeout: 15_000,
        headers: { "User-Agent": this.userAgent, "Content-Type": "application/json" },
        validateStatus: () => true,
        httpsAgent: this.client.defaults.httpsAgent as https.Agent | undefined,
      }
    );
    if (res.status !== 200 || !res.data?.token) {
      throw new WPError(
        `JWT token fetch failed: HTTP ${res.status} ${
          res.data?.message ?? ""
        } — ` +
          `verify the JWT plugin is installed at namespace '${this.jwtNamespace}' ` +
          `and that JWT_AUTH_SECRET_KEY is set in wp-config.php.`,
        {
          status: res.status,
          code: res.data?.code ?? "jwt_token_fetch_failed",
          details: res.data,
        }
      );
    }
    this.jwtToken = res.data.token as string;
    this.client.defaults.headers["Authorization"] = `Bearer ${this.jwtToken}`;
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  private buildQuery(
    params?: WPQueryParams
  ): Record<string, string | number | boolean> {
    if (!params) return {};
    const query: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        query[key] = value.join(",");
      } else if (typeof value === "boolean") {
        query[key] = value ? 1 : 0;
      } else if (typeof value === "string" || typeof value === "number") {
        query[key] = value;
      }
    }
    return query;
  }

  /**
   * Wrap axios request with retry on transient errors and structured error
   * formatting that surfaces WordPress' own `code`/`message` fields.
   */
  private async request<T>(config: AxiosRequestConfig): Promise<{
    data: T;
    headers: Record<string, string>;
  }> {
    // For WooCommerce routes, prefer Consumer Key/Secret if provided.
    const finalConfig = this.applyWcAuth(config);
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      attempt++;
      try {
        const res = await this.client.request<T>(finalConfig);
        if (res.status >= 200 && res.status < 300) {
          return {
            data: res.data,
            headers: (res.headers ?? {}) as Record<string, string>,
          };
        }
        // Non-2xx
        const shouldRetry =
          attempt <= this.maxRetries && RETRY_STATUSES.has(res.status);
        if (shouldRetry) {
          await this.sleep(this.backoffMs(attempt, res.headers));
          continue;
        }
        throw this.toError(res.status, res.data, finalConfig);
      } catch (err) {
        if (err instanceof WPError) throw err;
        const ax = err as AxiosError;
        const transient =
          ax.code === "ECONNRESET" ||
          ax.code === "ETIMEDOUT" ||
          ax.code === "EAI_AGAIN" ||
          ax.code === "ECONNABORTED";
        if (transient && attempt <= this.maxRetries) {
          await this.sleep(this.backoffMs(attempt));
          continue;
        }
        throw new WPError(
          `WordPress request failed: ${ax.message ?? String(err)}`,
          { cause: err, status: 0, code: ax.code ?? "network_error" }
        );
      }
    }
  }

  private backoffMs(attempt: number, headers?: unknown): number {
    // Honor Retry-After header if present.
    if (headers && typeof headers === "object") {
      const h = headers as Record<string, string>;
      const retryAfter = h["retry-after"] ?? h["Retry-After"];
      if (retryAfter) {
        const secs = Number(retryAfter);
        if (!Number.isNaN(secs)) return secs * 1000;
      }
    }
    // Exponential backoff with jitter, capped at 8s.
    return Math.min(8000, 250 * 2 ** (attempt - 1)) + Math.random() * 200;
  }

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /**
   * If the request targets WooCommerce (/wc/* or /wc-analytics/*) AND
   * Consumer Key/Secret are configured, attach them as query params and
   * strip the Authorization header. WC accepts CK/CS over HTTPS as basic
   * params; we always assume HTTPS and rely on TLS for confidentiality.
   */
  private applyWcAuth(config: AxiosRequestConfig): AxiosRequestConfig {
    if (!this.wcKey || !this.wcSecret) return config;
    const url = config.url ?? "";
    const isWc = url.startsWith("/wc/") || url.startsWith("/wc-analytics/");
    if (!isWc) return config;
    return {
      ...config,
      params: {
        ...(config.params ?? {}),
        consumer_key: this.wcKey,
        consumer_secret: this.wcSecret,
      },
      headers: {
        ...(config.headers ?? {}),
        // Avoid sending double credentials.
        Authorization: undefined as unknown as string,
      },
    };
  }

  private toError(
    status: number,
    body: unknown,
    config: AxiosRequestConfig
  ): WPError {
    const url = `${config.method?.toUpperCase() ?? "GET"} ${config.url}`;
    if (
      body &&
      typeof body === "object" &&
      "message" in body &&
      "code" in body
    ) {
      const b = body as { message: string; code: string; data?: unknown };
      return new WPError(`${b.message} (${b.code}) [${url}]`, {
        status,
        code: b.code,
        details: b.data,
      });
    }
    return new WPError(`HTTP ${status} from ${url}`, {
      status,
      code: "http_error",
      details: body,
    });
  }

  // ─── Generic core (used by CPT/taxonomy generic tools) ────────────────────

  /**
   * Generic list call. `route` is e.g. "wp/v2/posts" or "wc/v3/products".
   */
  async list<T = unknown>(
    route: string,
    params?: WPQueryParams
  ): Promise<WPListResult<T>> {
    const { data, headers } = await this.request<T[]>({
      method: "GET",
      url: `/${route}`,
      params: this.buildQuery(params),
    });
    return {
      data,
      total: Number(headers["x-wp-total"] ?? data.length ?? 0),
      pages: Number(headers["x-wp-totalpages"] ?? 1),
    };
  }

  async get<T = unknown>(route: string, id: number, params?: WPQueryParams) {
    const { data } = await this.request<T>({
      method: "GET",
      url: `/${route}/${id}`,
      params: this.buildQuery(params),
    });
    return data;
  }

  async create<T = unknown>(route: string, body: Record<string, unknown>) {
    const { data } = await this.request<T>({
      method: "POST",
      url: `/${route}`,
      data: body,
      headers: { "Content-Type": "application/json" },
    });
    return data;
  }

  async update<T = unknown>(
    route: string,
    id: number,
    body: Record<string, unknown>
  ) {
    const { data } = await this.request<T>({
      method: "POST", // WP accepts POST for updates and many hosts strip PUT.
      url: `/${route}/${id}`,
      data: body,
      headers: { "Content-Type": "application/json" },
    });
    return data;
  }

  async remove<T = unknown>(route: string, id: number, force = false) {
    const { data } = await this.request<T>({
      method: "DELETE",
      url: `/${route}/${id}`,
      params: { force },
    });
    return data;
  }

  /**
   * Low-level escape hatch: send an arbitrary GET / POST to a fully
   * specified path. Used by tools that work with string IDs (e.g. block
   * templates) or non-`wp/v2` routes that don't fit list/get/create/update.
   */
  async raw<T = unknown>(opts: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";
    path: string;
    query?: WPQueryParams;
    body?: Record<string, unknown>;
  }): Promise<T> {
    const { data } = await this.request<T>({
      method: opts.method ?? "GET",
      url: opts.path.startsWith("/") ? opts.path : `/${opts.path}`,
      params: opts.query ? this.buildQuery(opts.query) : undefined,
      data: opts.body,
      headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    });
    return data;
  }

  // ─── Convenience wrappers (wp/v2 namespace) ───────────────────────────────

  posts = {
    list: (p?: WPQueryParams) => this.list("wp/v2/posts", p),
    get: (id: number, p?: WPQueryParams) => this.get("wp/v2/posts", id, p),
    create: (body: Record<string, unknown>) => this.create("wp/v2/posts", body),
    update: (id: number, body: Record<string, unknown>) =>
      this.update("wp/v2/posts", id, body),
    remove: (id: number, force = false) =>
      this.remove("wp/v2/posts", id, force),
    revisions: (id: number, p?: WPQueryParams) =>
      this.list(`wp/v2/posts/${id}/revisions`, p),
  };

  pages = {
    list: (p?: WPQueryParams) => this.list("wp/v2/pages", p),
    get: (id: number, p?: WPQueryParams) => this.get("wp/v2/pages", id, p),
    create: (body: Record<string, unknown>) => this.create("wp/v2/pages", body),
    update: (id: number, body: Record<string, unknown>) =>
      this.update("wp/v2/pages", id, body),
    remove: (id: number, force = false) =>
      this.remove("wp/v2/pages", id, force),
  };

  media = {
    list: (p?: WPQueryParams) => this.list("wp/v2/media", p),
    get: (id: number) => this.get("wp/v2/media", id),
    update: (id: number, body: Record<string, unknown>) =>
      this.update("wp/v2/media", id, body),
    remove: (id: number, force = true) =>
      this.remove("wp/v2/media", id, force),
  };

  categories = {
    list: (p?: WPQueryParams) => this.list("wp/v2/categories", p),
    get: (id: number) => this.get("wp/v2/categories", id),
    create: (body: Record<string, unknown>) =>
      this.create("wp/v2/categories", body),
    update: (id: number, body: Record<string, unknown>) =>
      this.update("wp/v2/categories", id, body),
    remove: (id: number, force = false) =>
      this.remove("wp/v2/categories", id, force),
  };

  tags = {
    list: (p?: WPQueryParams) => this.list("wp/v2/tags", p),
    get: (id: number) => this.get("wp/v2/tags", id),
    create: (body: Record<string, unknown>) => this.create("wp/v2/tags", body),
    update: (id: number, body: Record<string, unknown>) =>
      this.update("wp/v2/tags", id, body),
    remove: (id: number, force = false) =>
      this.remove("wp/v2/tags", id, force),
  };

  comments = {
    list: (p?: WPQueryParams) => this.list("wp/v2/comments", p),
    get: (id: number) => this.get("wp/v2/comments", id),
    create: (body: Record<string, unknown>) =>
      this.create("wp/v2/comments", body),
    update: (id: number, body: Record<string, unknown>) =>
      this.update("wp/v2/comments", id, body),
    remove: (id: number, force = false) =>
      this.remove("wp/v2/comments", id, force),
  };

  users = {
    list: (p?: WPQueryParams) => this.list("wp/v2/users", p),
    get: (id: number) => this.get("wp/v2/users", id),
    me: async () => {
      const { data } = await this.request({ method: "GET", url: "/wp/v2/users/me" });
      return data;
    },
    create: (body: Record<string, unknown>) => this.create("wp/v2/users", body),
    update: (id: number, body: Record<string, unknown>) =>
      this.update("wp/v2/users", id, body),
    remove: async (id: number, reassignTo: number) => {
      const { data } = await this.request({
        method: "DELETE",
        url: `/wp/v2/users/${id}`,
        params: { force: true, reassign: reassignTo },
      });
      return data;
    },
  };

  // ─── Site / discovery ─────────────────────────────────────────────────────

  async siteInfo() {
    // The /wp-json index does not require auth. Use a clean axios call so we
    // don't accidentally send Basic auth to a public endpoint.
    const res = await axios.get(`${this.baseUrl}/wp-json`, {
      timeout: 15_000,
      headers: { "User-Agent": this.userAgent },
      validateStatus: () => true,
    });
    if (res.status !== 200) {
      throw new WPError(`Cannot reach REST root: HTTP ${res.status}`, {
        status: res.status,
        code: "rest_root_unreachable",
      });
    }
    return res.data;
  }

  async settings() {
    const { data } = await this.request({
      method: "GET",
      url: "/wp/v2/settings",
    });
    return data;
  }

  async updateSettings(body: Record<string, unknown>) {
    const { data } = await this.request({
      method: "POST",
      url: "/wp/v2/settings",
      data: body,
    });
    return data;
  }

  async types() {
    const { data } = await this.request({ method: "GET", url: "/wp/v2/types" });
    return data;
  }

  async taxonomies() {
    const { data } = await this.request({
      method: "GET",
      url: "/wp/v2/taxonomies",
    });
    return data;
  }

  async search(
    query: string,
    params?: { type?: string; subtype?: string; page?: number; per_page?: number }
  ) {
    const { data, headers } = await this.request<unknown[]>({
      method: "GET",
      url: "/wp/v2/search",
      params: { search: query, ...params },
    });
    return {
      data,
      total: Number((headers as Record<string, string>)["x-wp-total"] ?? 0),
    };
  }

  // ─── Media upload (multipart) ─────────────────────────────────────────────

  async uploadMediaFromFile(
    filePath: string,
    metadata?: {
      title?: string;
      alt_text?: string;
      caption?: string;
      description?: string;
      post?: number;
    }
  ) {
    const fileContent = readFileSync(filePath);
    const fileName = basename(filePath);
    const form = new FormData();
    form.append("file", fileContent, fileName);
    if (metadata?.title) form.append("title", metadata.title);
    if (metadata?.alt_text) form.append("alt_text", metadata.alt_text);
    if (metadata?.caption) form.append("caption", metadata.caption);
    if (metadata?.description) form.append("description", metadata.description);
    if (metadata?.post != null) form.append("post", String(metadata.post));

    const { data } = await this.request({
      method: "POST",
      url: "/wp/v2/media",
      data: form,
      headers: {
        ...form.getHeaders(),
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    return data;
  }

  async uploadMediaFromUrl(
    fileUrl: string,
    metadata?: {
      title?: string;
      alt_text?: string;
      caption?: string;
      description?: string;
      post?: number;
    }
  ) {
    const res = await axios.get<ArrayBuffer>(fileUrl, {
      responseType: "arraybuffer",
      timeout: 60_000,
    });
    const buf = Buffer.from(res.data);
    const fileName = basename(new URL(fileUrl).pathname) || "upload.bin";
    const form = new FormData();
    form.append("file", buf, fileName);
    if (metadata?.title) form.append("title", metadata.title);
    if (metadata?.alt_text) form.append("alt_text", metadata.alt_text);
    if (metadata?.caption) form.append("caption", metadata.caption);
    if (metadata?.description) form.append("description", metadata.description);
    if (metadata?.post != null) form.append("post", String(metadata.post));

    const { data } = await this.request({
      method: "POST",
      url: "/wp/v2/media",
      data: form,
      headers: {
        ...form.getHeaders(),
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    return data;
  }

  // ─── Batch (/batch/v1) — WP 5.6+ ─────────────────────────────────────────

  /**
   * Discover the batch endpoint capabilities. Returns the parsed OPTIONS body
   * which contains `endpoints[0].args.requests.maxItems` (default 25).
   */
  async batchOptions() {
    const { data } = await this.request<unknown>({
      method: "OPTIONS",
      url: "/batch/v1",
    });
    return data;
  }

  /**
   * Send a batch of write operations to /batch/v1.
   * GET is not supported by core; only POST/PUT/PATCH/DELETE.
   */
  async batch(
    requests: Array<{
      method?: "POST" | "PUT" | "PATCH" | "DELETE";
      path: string;
      headers?: Record<string, string | string[]>;
      body?: Record<string, unknown>;
    }>,
    validation: "normal" | "require-all-validate" = "normal"
  ) {
    const { data } = await this.request<{
      failed?: string;
      responses: Array<unknown>;
    }>({
      method: "POST",
      url: "/batch/v1",
      data: { validation, requests },
      headers: { "Content-Type": "application/json" },
    });
    return data;
  }

  // ─── JWT helper ──────────────────────────────────────────────────────────

  /** Validate the current JWT against /token/validate. */
  async validateJwt(): Promise<unknown> {
    if (this.authMode !== "jwt") {
      throw new WPError("Server is not running in JWT mode", {
        status: 0,
        code: "wrong_auth_mode",
      });
    }
    const { data } = await this.request({
      method: "POST",
      url: `/${this.jwtNamespace}/token/validate`,
    });
    return data;
  }
}

/**
 * Custom error class that carries the WP REST API error code & status.
 * Tool runners convert this to MCP `isError` results.
 */
export class WPError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(
    message: string,
    opts: { status: number; code: string; details?: unknown; cause?: unknown }
  ) {
    super(message);
    this.name = "WPError";
    this.status = opts.status;
    this.code = opts.code;
    this.details = opts.details;
    if (opts.cause) (this as { cause?: unknown }).cause = opts.cause;
  }
}
