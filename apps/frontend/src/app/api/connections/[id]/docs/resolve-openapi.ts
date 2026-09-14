export type ConnectionDocsCredentials = {
  docsUrl: string;
  accessToken: string;
  baseApi?: string | null;
  baseUrl?: string | null;
};

export type ResolvedOpenApi = {
  sourceUrl: string;
  body: string;
  contentType: string;
};

function addUnique(urls: string[], value?: string | null) {
  if (!value) return;
  if (!urls.includes(value)) urls.push(value);
}

/** Build candidate OpenAPI/Swagger spec URLs from a docs portal URL + connection bases. */
export function buildCandidateSpecUrls(creds: ConnectionDocsCredentials): string[] {
  const urls: string[] = [];
  addUnique(urls, creds.docsUrl);

  try {
    const parsed = new URL(creds.docsUrl);
    if (/swagger-ui|\.html?$/i.test(parsed.pathname)) {
      const stripped = parsed.pathname
        .replace(/\/swagger-ui(?:\/index\.html)?\/?$/i, '')
        .replace(/\/[^/]+\.html?$/i, '');
      for (const suffix of ['/v3/api-docs', '/v2/api-docs', '/swagger.json', '/openapi.json']) {
        addUnique(urls, `${parsed.origin}${stripped}${suffix}`);
      }
    }
  } catch {
    // ignore invalid docsUrl — caller already got it from the API
  }

  const bases = [creds.baseApi, creds.baseUrl]
    .filter((v): v is string => !!v)
    .map((v) => v.replace(/\/$/, ''));

  for (const base of bases) {
    for (const suffix of ['/v3/api-docs', '/v2/api-docs', '/swagger.json', '/openapi.json']) {
      addUnique(urls, `${base}${suffix}`);
    }
  }

  return urls;
}

export function isOpenApiBody(contentType: string, body: string): boolean {
  const trimmed = body.trimStart();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(body) as { openapi?: unknown; swagger?: unknown };
      return parsed.openapi != null || parsed.swagger != null;
    } catch {
      return false;
    }
  }

  if (/^openapi\s*:/m.test(trimmed) || /^swagger\s*:/m.test(trimmed)) {
    return true;
  }

  const ct = contentType.toLowerCase();
  return (
    (ct.includes('yaml') || ct.includes('yml')) &&
    (trimmed.includes('openapi:') || trimmed.includes('swagger:'))
  );
}

export function looksLikeHtmlPortalUrl(docsUrl: string): boolean {
  try {
    const path = new URL(docsUrl).pathname.toLowerCase();
    return path.includes('swagger-ui') || path.endsWith('.html') || path.endsWith('.htm');
  } catch {
    return false;
  }
}

export async function resolveOpenApiSpec(
  creds: ConnectionDocsCredentials,
): Promise<ResolvedOpenApi | null> {
  const candidates = buildCandidateSpecUrls(creds);

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          Accept: 'application/json, application/yaml, text/yaml, application/octet-stream, */*',
        },
        redirect: 'follow',
      });
      if (!res.ok) continue;

      const contentType = res.headers.get('content-type') ?? 'application/json';
      const body = await res.text();
      if (!isOpenApiBody(contentType, body)) continue;

      const normalizedType = body.trimStart().startsWith('{')
        ? 'application/json'
        : contentType.includes('yaml') || contentType.includes('yml')
          ? contentType
          : 'application/yaml';

      return { sourceUrl: url, body, contentType: normalizedType };
    } catch {
      continue;
    }
  }

  return null;
}
