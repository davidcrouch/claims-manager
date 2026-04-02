/**
 * E2E test for tool.os.web that hits real DuckDuckGo (no mocks).
 * Run with: pnpm test -- web.e2e
 * Requires network access to api.duckduckgo.com.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { search, fetch } from "./web.js";

describe("tool.os.web (e2e with DuckDuckGo)", () => {
  beforeAll(() => {
    delete process.env.SEARCH_API_URL;
  }, 10_000);

  describe("search (live DuckDuckGo)", () => {
    it("returns valid response shape (query, results array, total); when DuckDuckGo returns results, each has title/url/snippet", async () => {
      const result = await search(
        { query: "Node.js LTS schedule", num_results: 5 },
        {}
      );
      expect(result).not.toHaveProperty("error");
      expect(result).toHaveProperty("query", "Node.js LTS schedule");
      expect(result).toHaveProperty("results");
      expect(Array.isArray((result as { results: unknown[] }).results)).toBe(true);
      expect(result).toHaveProperty("total");
      expect(typeof (result as { total: number }).total).toBe("number");
      const results = (result as { results: Array<{ title: string; url: string; snippet: string }> }).results;
      for (const r of results) {
        expect(r).toHaveProperty("title");
        expect(r).toHaveProperty("url");
        expect(r).toHaveProperty("snippet");
        expect(r.url).toMatch(/^https?:\/\//);
      }
    }, 15_000);
  });

  describe("fetch (live HTTP)", () => {
    it("fetches a real URL and returns status, body, headers", async () => {
      const result = await fetch({ url: "https://example.com" }, {});
      expect(result).not.toHaveProperty("error");
      expect(result).toHaveProperty("status", 200);
      expect(result).toHaveProperty("body");
      expect(typeof (result as { body: string }).body).toBe("string");
      expect((result as { body: string }).body.length).toBeGreaterThan(0);
      expect(result).toHaveProperty("headers");
      expect(result).toHaveProperty("truncated", false);
    }, 15_000);
  });
});
