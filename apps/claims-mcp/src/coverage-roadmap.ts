/**
 * MCP category mounts (ops + admin co-located by product):
 * - /operations/mcp
 * - /documents/mcp
 * - /filesystem/mcp
 * - /ai/mcp
 * - /organisation/mcp
 * - /mcp (aggregate)
 *
 * Domain tool modules remain split by Nest controller; CATEGORY_REGISTRARS
 * in server.ts composes them into the mounts above.
 */
export const CLAIMS_MCP_COVERAGE_ROADMAP = true;
