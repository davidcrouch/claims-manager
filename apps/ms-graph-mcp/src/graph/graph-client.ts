export interface GraphClientConfig {
  accessToken: string;
  baseUrl?: string;
}

export interface PaginatedResponse<T> {
  value: T[];
  nextLink?: string;
}

export class GraphClient {
  private readonly baseUrl: string;
  private readonly accessToken: string;

  constructor(config: GraphClientConfig) {
    this.baseUrl = config.baseUrl ?? 'https://graph.microsoft.com/v1.0';
    this.accessToken = config.accessToken;
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = this.buildUrl(path, params);
    console.log(`[GraphClient.get] ${path}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers(),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`[GraphClient.get] ${response.status} ${response.statusText}: ${body}`);
    }

    return response.json() as Promise<T>;
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const url = this.buildUrl(path);
    console.log(`[GraphClient.post] ${path}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`[GraphClient.post] ${response.status} ${response.statusText}: ${text}`);
    }

    const text = await response.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    const url = this.buildUrl(path);
    console.log(`[GraphClient.patch] ${path}`);

    const response = await fetch(url, {
      method: 'PATCH',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`[GraphClient.patch] ${response.status} ${response.statusText}: ${text}`);
    }

    const text = await response.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }

  async delete(path: string): Promise<void> {
    const url = this.buildUrl(path);
    console.log(`[GraphClient.delete] ${path}`);

    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.headers(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`[GraphClient.delete] ${response.status} ${response.statusText}: ${text}`);
    }
  }

  async getPaginated<T>(
    path: string,
    params?: Record<string, string>,
    maxPages = 5,
  ): Promise<T[]> {
    const results: T[] = [];
    let url: string | undefined = this.buildUrl(path, params);
    let pages = 0;

    while (url && pages < maxPages) {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers(),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`[GraphClient.getPaginated] ${response.status} ${response.statusText}: ${text}`);
      }

      const data = (await response.json()) as PaginatedResponse<T>;
      if (data.value) {
        results.push(...data.value);
      }

      url = (data as unknown as Record<string, unknown>)['@odata.nextLink'] as string | undefined;
      pages++;
    }

    if (url) {
      console.log(`[GraphClient.getPaginated] pagination capped at ${maxPages} pages, ${results.length} items`);
    }

    return results;
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    const base = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    if (!params || Object.keys(params).length === 0) return base;
    const searchParams = new URLSearchParams(params);
    return `${base}?${searchParams.toString()}`;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.accessToken}`,
    };
  }
}
