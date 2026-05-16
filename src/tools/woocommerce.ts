import { z } from "zod";
import { WordPressClient } from "../wordpress-client.js";
import type { ToolDef } from "../types.js";

/**
 * WooCommerce REST API tools (namespace `wc/v3`).
 *
 * Auth: if WC_CONSUMER_KEY / WC_CONSUMER_SECRET are configured the client
 * automatically uses them for /wc/* routes; otherwise it falls back to the
 * Application Password (the WP user must have `manage_woocommerce`).
 *
 * Coverage: products, product variations, orders, customers, coupons,
 * categories, refunds, reports. For anything else, use the generic
 * `wp_list_items` / `wp_create_item` tools with route `wc/v3/...`.
 */

const orderEnum = z.enum(["asc", "desc"]);

// ─── Products ─────────────────────────────────────────────────────────────

const productListSchema = {
  page: z.number().int().positive().optional(),
  per_page: z.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
  status: z.enum(["any", "draft", "pending", "private", "publish"]).optional(),
  type: z.enum(["simple", "grouped", "external", "variable"]).optional(),
  category: z.string().optional().describe("Category slug"),
  tag: z.string().optional().describe("Tag slug"),
  sku: z.string().optional(),
  featured: z.boolean().optional(),
  on_sale: z.boolean().optional(),
  min_price: z.string().optional(),
  max_price: z.string().optional(),
  stock_status: z.enum(["instock", "outofstock", "onbackorder"]).optional(),
  orderby: z
    .enum(["date", "id", "include", "title", "slug", "price", "popularity", "rating"])
    .optional(),
  order: orderEnum.optional(),
  after: z.string().optional(),
  before: z.string().optional(),
  _fields: z.string().optional(),
};

const productCreateSchema = {
  name: z.string().min(1),
  type: z.enum(["simple", "grouped", "external", "variable"]).optional(),
  regular_price: z.string().optional(),
  sale_price: z.string().optional(),
  description: z.string().optional(),
  short_description: z.string().optional(),
  sku: z.string().optional(),
  status: z.enum(["draft", "pending", "private", "publish"]).optional(),
  featured: z.boolean().optional(),
  catalog_visibility: z.enum(["visible", "catalog", "search", "hidden"]).optional(),
  manage_stock: z.boolean().optional(),
  stock_quantity: z.number().int().optional(),
  stock_status: z.enum(["instock", "outofstock", "onbackorder"]).optional(),
  weight: z.string().optional(),
  dimensions: z
    .object({
      length: z.string().optional(),
      width: z.string().optional(),
      height: z.string().optional(),
    })
    .optional(),
  categories: z.array(z.object({ id: z.number().int() })).optional(),
  tags: z.array(z.object({ id: z.number().int() })).optional(),
  images: z
    .array(
      z.object({
        id: z.number().int().optional(),
        src: z.string().url().optional(),
        alt: z.string().optional(),
        name: z.string().optional(),
      })
    )
    .optional(),
  attributes: z
    .array(
      z.object({
        id: z.number().int().optional(),
        name: z.string().optional(),
        position: z.number().int().optional(),
        visible: z.boolean().optional(),
        variation: z.boolean().optional(),
        options: z.array(z.string()).optional(),
      })
    )
    .optional(),
  meta_data: z
    .array(z.object({ key: z.string(), value: z.unknown() }))
    .optional(),
};

// ─── Orders ───────────────────────────────────────────────────────────────

const orderStatus = z.enum([
  "any",
  "pending",
  "processing",
  "on-hold",
  "completed",
  "cancelled",
  "refunded",
  "failed",
  "trash",
]);

const orderListSchema = {
  page: z.number().int().positive().optional(),
  per_page: z.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
  status: orderStatus.optional(),
  customer: z.number().int().optional(),
  product: z.number().int().optional(),
  after: z.string().optional(),
  before: z.string().optional(),
  orderby: z.enum(["date", "id", "include", "title", "slug"]).optional(),
  order: orderEnum.optional(),
  _fields: z.string().optional(),
};

// ─── Tools ────────────────────────────────────────────────────────────────

export const woocommerceTools = (wp: WordPressClient): ToolDef[] => [
  // ── Products ───────────────────────────────────────────────────────────
  {
    name: "wc_list_products",
    title: "WC: list products",
    description: "List WooCommerce products with filters.",
    inputSchema: productListSchema,
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => {
      const r = await wp.list("wc/v3/products", input);
      return { products: r.data, total: r.total, total_pages: r.pages };
    },
  },
  {
    name: "wc_get_product",
    title: "WC: get product",
    description: "Get a single product by ID.",
    inputSchema: { id: z.number().int().positive() },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => wp.get("wc/v3/products", (input as { id: number }).id),
  },
  {
    name: "wc_create_product",
    title: "WC: create product",
    description: "Create a new WooCommerce product.",
    inputSchema: productCreateSchema,
    annotations: { openWorldHint: true },
    handler: async (input) => wp.create("wc/v3/products", input as Record<string, unknown>),
  },
  {
    name: "wc_update_product",
    title: "WC: update product",
    description: "Update a WooCommerce product.",
    inputSchema: { id: z.number().int().positive(), ...productCreateSchema },
    annotations: { openWorldHint: true },
    handler: async (input) => {
      const { id, ...data } = input as { id: number; [k: string]: unknown };
      // All productCreateSchema fields are required at the top level, but
      // for updates we want them optional. Strip undefined explicitly so
      // we don't send them. (Zod already drops undefined; keep cast safe.)
      return wp.update("wc/v3/products", id, data);
    },
  },
  {
    name: "wc_delete_product",
    title: "WC: delete product",
    description:
      "Delete a WooCommerce product. force=true is irreversible (skips trash).",
    inputSchema: {
      id: z.number().int().positive(),
      force: z.boolean().optional(),
    },
    annotations: { destructiveHint: true, openWorldHint: true },
    handler: async (input) => {
      const { id, force = false } = input as { id: number; force?: boolean };
      return wp.remove("wc/v3/products", id, force);
    },
  },

  // ── Product variations ─────────────────────────────────────────────────
  {
    name: "wc_list_variations",
    title: "WC: list product variations",
    description: "List variations of a variable product.",
    inputSchema: {
      product_id: z.number().int().positive(),
      page: z.number().int().positive().optional(),
      per_page: z.number().int().min(1).max(100).optional(),
      _fields: z.string().optional(),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => {
      const { product_id, ...rest } = input as { product_id: number; [k: string]: unknown };
      const r = await wp.list(`wc/v3/products/${product_id}/variations`, rest);
      return { variations: r.data, total: r.total };
    },
  },
  {
    name: "wc_create_variation",
    title: "WC: create product variation",
    description: "Create a variation under a variable product.",
    inputSchema: {
      product_id: z.number().int().positive(),
      regular_price: z.string().optional(),
      sale_price: z.string().optional(),
      sku: z.string().optional(),
      stock_quantity: z.number().int().optional(),
      attributes: z
        .array(z.object({ id: z.number().int().optional(), name: z.string().optional(), option: z.string() }))
        .optional(),
      image: z.object({ id: z.number().int().optional(), src: z.string().url().optional() }).optional(),
    },
    annotations: { openWorldHint: true },
    handler: async (input) => {
      const { product_id, ...body } = input as { product_id: number; [k: string]: unknown };
      return wp.create(`wc/v3/products/${product_id}/variations`, body);
    },
  },

  // ── Categories ─────────────────────────────────────────────────────────
  {
    name: "wc_list_product_categories",
    title: "WC: list product categories",
    description: "List WooCommerce product categories.",
    inputSchema: {
      page: z.number().int().positive().optional(),
      per_page: z.number().int().min(1).max(100).optional(),
      search: z.string().optional(),
      hide_empty: z.boolean().optional(),
      parent: z.number().int().optional(),
      orderby: z.enum(["id", "include", "name", "slug", "term_group", "description", "count"]).optional(),
      order: orderEnum.optional(),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => {
      const r = await wp.list("wc/v3/products/categories", input);
      return { categories: r.data, total: r.total };
    },
  },

  // ── Orders ─────────────────────────────────────────────────────────────
  {
    name: "wc_list_orders",
    title: "WC: list orders",
    description: "List WooCommerce orders.",
    inputSchema: orderListSchema,
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => {
      const r = await wp.list("wc/v3/orders", input);
      return { orders: r.data, total: r.total, total_pages: r.pages };
    },
  },
  {
    name: "wc_get_order",
    title: "WC: get order",
    description: "Get a single order by ID.",
    inputSchema: { id: z.number().int().positive() },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => wp.get("wc/v3/orders", (input as { id: number }).id),
  },
  {
    name: "wc_update_order",
    title: "WC: update order",
    description: "Update an order — most commonly used to change status.",
    inputSchema: {
      id: z.number().int().positive(),
      status: orderStatus.optional(),
      customer_note: z.string().optional(),
      transaction_id: z.string().optional(),
      meta_data: z.array(z.object({ key: z.string(), value: z.unknown() })).optional(),
    },
    annotations: { openWorldHint: true },
    handler: async (input) => {
      const { id, ...data } = input as { id: number; [k: string]: unknown };
      return wp.update("wc/v3/orders", id, data);
    },
  },
  {
    name: "wc_create_order_note",
    title: "WC: add note to an order",
    description: "Add a note (private or customer-facing) to an order.",
    inputSchema: {
      order_id: z.number().int().positive(),
      note: z.string().min(1),
      customer_note: z.boolean().optional().describe("If true, visible to customer."),
    },
    annotations: { openWorldHint: true },
    handler: async (input) => {
      const { order_id, ...body } = input as { order_id: number; [k: string]: unknown };
      return wp.create(`wc/v3/orders/${order_id}/notes`, body);
    },
  },
  {
    name: "wc_create_refund",
    title: "WC: create order refund",
    description: "Create a refund for an order.",
    inputSchema: {
      order_id: z.number().int().positive(),
      amount: z.string().describe("Refund amount as decimal string, e.g. '12.50'"),
      reason: z.string().optional(),
      api_refund: z.boolean().optional().describe("Trigger payment gateway refund."),
      line_items: z
        .array(
          z.object({
            id: z.number().int(),
            quantity: z.number().int().optional(),
            refund_total: z.number().optional(),
          })
        )
        .optional(),
    },
    annotations: { destructiveHint: true, openWorldHint: true },
    handler: async (input) => {
      const { order_id, ...body } = input as { order_id: number; [k: string]: unknown };
      return wp.create(`wc/v3/orders/${order_id}/refunds`, body);
    },
  },

  // ── Customers ──────────────────────────────────────────────────────────
  {
    name: "wc_list_customers",
    title: "WC: list customers",
    description: "List WooCommerce customers.",
    inputSchema: {
      page: z.number().int().positive().optional(),
      per_page: z.number().int().min(1).max(100).optional(),
      search: z.string().optional(),
      email: z.string().email().optional(),
      role: z.string().optional(),
      orderby: z.enum(["id", "include", "name", "registered_date"]).optional(),
      order: orderEnum.optional(),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => {
      const r = await wp.list("wc/v3/customers", input);
      return { customers: r.data, total: r.total };
    },
  },
  {
    name: "wc_get_customer",
    title: "WC: get customer",
    description: "Get a single customer by ID.",
    inputSchema: { id: z.number().int().positive() },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => wp.get("wc/v3/customers", (input as { id: number }).id),
  },

  // ── Coupons ────────────────────────────────────────────────────────────
  {
    name: "wc_list_coupons",
    title: "WC: list coupons",
    description: "List WooCommerce coupons.",
    inputSchema: {
      page: z.number().int().positive().optional(),
      per_page: z.number().int().min(1).max(100).optional(),
      search: z.string().optional(),
      code: z.string().optional(),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => {
      const r = await wp.list("wc/v3/coupons", input);
      return { coupons: r.data, total: r.total };
    },
  },
  {
    name: "wc_create_coupon",
    title: "WC: create coupon",
    description: "Create a new coupon.",
    inputSchema: {
      code: z.string().min(1),
      discount_type: z.enum(["percent", "fixed_cart", "fixed_product"]).optional(),
      amount: z.string().optional(),
      individual_use: z.boolean().optional(),
      exclude_sale_items: z.boolean().optional(),
      minimum_amount: z.string().optional(),
      maximum_amount: z.string().optional(),
      usage_limit: z.number().int().optional(),
      usage_limit_per_user: z.number().int().optional(),
      date_expires: z.string().optional(),
      product_ids: z.array(z.number().int()).optional(),
      excluded_product_ids: z.array(z.number().int()).optional(),
      free_shipping: z.boolean().optional(),
      description: z.string().optional(),
    },
    annotations: { openWorldHint: true },
    handler: async (input) => wp.create("wc/v3/coupons", input as Record<string, unknown>),
  },

  // ── Reports ────────────────────────────────────────────────────────────
  {
    name: "wc_get_sales_report",
    title: "WC: sales report",
    description: "Get a sales summary report.",
    inputSchema: {
      period: z.enum(["week", "month", "last_month", "year"]).optional(),
      date_min: z.string().optional().describe("ISO date YYYY-MM-DD"),
      date_max: z.string().optional().describe("ISO date YYYY-MM-DD"),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => {
      const r = await wp.list("wc/v3/reports/sales", input);
      return { report: r.data };
    },
  },
  {
    name: "wc_get_top_sellers",
    title: "WC: top sellers report",
    description: "Get top-selling products.",
    inputSchema: {
      period: z.enum(["week", "month", "last_month", "year"]).optional(),
      date_min: z.string().optional(),
      date_max: z.string().optional(),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    handler: async (input) => {
      const r = await wp.list("wc/v3/reports/top_sellers", input);
      return { top_sellers: r.data };
    },
  },
];
