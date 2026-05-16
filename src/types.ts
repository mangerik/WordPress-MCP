import type { ZodRawShape } from "zod";

/**
 * Shape of an MCP tool definition used internally.
 * The handler returns any plain JS value; the runner will wrap it
 * into a proper CallToolResult ({ content, structuredContent, isError }).
 */
export interface ToolDef<Shape extends ZodRawShape = ZodRawShape> {
  name: string;
  title?: string;
  description: string;
  /** Raw zod shape (not z.object). The MCP SDK will build the JSON schema. */
  inputSchema: Shape;
  /** Handler receives validated input, returns plain JS value or throws. */
  handler: (input: Record<string, unknown>) => Promise<unknown>;
  /**
   * Hint about side effects, used by clients to decide whether to ask
   * the user for confirmation before executing.
   */
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
}
