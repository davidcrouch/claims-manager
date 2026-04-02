/**
 * Unit tests for tool.os.web (search and fetch).
 * Mocks global fetch to avoid network calls and assert behaviour.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { search, fetch } from './web.js';

const LOG = 'more0ai:web';

describe('tool.os.web', () => {
  let originalFetch: typeof globalThis.fetch;
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalEnv = process.env.SEARCH_API_URL;
    delete process.env.SEARCH_API_URL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    if (originalEnv !== undefined) process.env.SEARCH_API_URL = originalEnv;
    else delete process.env.SEARCH_API_URL;
  });

  describe('search', () => {
    it('returns error when query is missing', async () => {
      const result = await search({}, {});
      expect(result).toEqual({ error: `${LOG}:search - 'query' is required` });
    });

    it('returns error when query is empty string', async () => {
      const result = await search({ query: '   ' }, {});
      expect(result).toEqual({ error: `${LOG}:search - 'query' is required` });
    });

    it('returns parsed results when DuckDuckGo returns Abstract + RelatedTopics', async () => {
      const mockDuckDuckGo = {
        AbstractText: 'Node.js LTS schedule summary',
        AbstractURL: 'https://nodejs.org/en/about/previous-releases',
        Heading: 'Node LTS',
        RelatedTopics: [
          { FirstURL: 'https://example.com/1', Text: 'First result snippet' },
          { FirstURL: 'https://example.com/2', Text: 'Second result snippet' },
        ],
      };

      globalThis.fetch = vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockDuckDuckGo), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      ) as typeof fetch;

      const result = await search({ query: 'Node.js LTS schedule' }, {});

      expect(result).not.toHaveProperty('error');
      expect(result).toMatchObject({
        query: 'Node.js LTS schedule',
        total: 3,
      });
      expect(Array.isArray((result as { results?: unknown[] }).results)).toBe(true);
      const results = (result as { results: Array<{ title: string; url: string; snippet: string }> }).results;
      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({
        title: 'Node LTS',
        url: 'https://nodejs.org/en/about/previous-releases',
        snippet: 'Node.js LTS schedule summary',
      });
      expect(results[1].url).toBe('https://example.com/1');
      expect(results[2].url).toBe('https://example.com/2');
    });

    it('returns results from custom search API when SEARCH_API_URL is set', async () => {
      process.env.SEARCH_API_URL = 'https://custom.search/api';

      const customResults = {
        results: [
          { title: 'Custom 1', url: 'https://a.com/1', snippet: 'Snippet 1' },
          { title: 'Custom 2', link: 'https://a.com/2', description: 'Snippet 2' },
        ],
      };

      globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
        expect(url).toContain('https://custom.search/api');
        expect(url).toContain('q=');
        expect(url).toContain('limit=');
        return Promise.resolve(
          new Response(JSON.stringify(customResults), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }) as typeof fetch;

      const result = await search({ query: 'TypeScript 5', num_results: 10 }, {});

      expect(result).not.toHaveProperty('error');
      expect(result).toMatchObject({ query: 'TypeScript 5', total: 2 });
      const results = (result as { results: Array<{ title: string; url: string; snippet: string }> }).results;
      expect(results[0]).toEqual({ title: 'Custom 1', url: 'https://a.com/1', snippet: 'Snippet 1' });
      expect(results[1]).toEqual({ title: 'Custom 2', url: 'https://a.com/2', snippet: 'Snippet 2' });
    });

    it('respects num_results between 1 and 20', async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              RelatedTopics: Array.from({ length: 25 }, (_, i) => ({
                FirstURL: `https://example.com/${i}`,
                Text: `Snippet ${i}`,
              })),
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        )
      ) as typeof fetch;

      const result = await search({ query: 'test', num_results: 3 }, {});
      const results = (result as { results: unknown[] }).results;
      expect(results).toHaveLength(3);
    });
  });

  describe('fetch', () => {
    it('returns error when url is missing', async () => {
      const result = await fetch({}, {});
      expect(result).toEqual({ error: `${LOG}:fetch - 'url' is required` });
    });

    it('returns error when url does not start with http:// or https://', async () => {
      const result = await fetch({ url: 'ftp://example.com' }, {});
      expect(result).toEqual({ error: `${LOG}:fetch - URL must start with http:// or https://` });
    });

    it('returns status, headers and body when GET succeeds', async () => {
      const bodyText = 'Hello, World!';
      globalThis.fetch = vi.fn(() =>
        Promise.resolve(
          new Response(bodyText, {
            status: 200,
            statusText: 'OK',
            headers: new Headers({ 'Content-Type': 'text/plain', 'X-Custom': 'value' }),
          })
        )
      ) as typeof fetch;

      const result = await fetch({ url: 'https://example.com/page' }, {});

      expect(result).not.toHaveProperty('error');
      expect(result).toMatchObject({
        status: 200,
        status_text: 'OK',
        body: bodyText,
        truncated: false,
      });
      expect((result as { headers?: Record<string, string> }).headers).toBeDefined();
      expect((result as { content_type?: string }).content_type).toContain('text/plain');
    });

    it('returns error when fetch throws', async () => {
      globalThis.fetch = vi.fn(() => Promise.reject(new Error('Network failure'))) as typeof fetch;

      const result = await fetch({ url: 'https://example.com' }, {});

      expect(result).toHaveProperty('error');
      expect((result as { error: string }).error).toContain('Network failure');
    });
  });
});
