import { NextRequest, NextResponse } from 'next/server';
import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import {
  looksLikeHtmlPortalUrl,
  resolveOpenApiSpec,
  type ConnectionDocsCredentials,
} from './resolve-openapi';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session.authenticated) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const token = await getAccessToken();
  if (!token) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { id } = await params;
  const api = createApiClient({ token });

  let creds: ConnectionDocsCredentials;
  try {
    creds = await api.getConnectionDocsUrl(id);
  } catch {
    return new NextResponse('Failed to retrieve API documentation credentials', {
      status: 502,
    });
  }

  const resolved = await resolveOpenApiSpec(creds);

  // HTML documentation portals cannot be loaded into Swagger UI (and hit CORS
  // when the browser fetches them). Open the portal directly when we cannot
  // resolve an OpenAPI/Swagger JSON/YAML spec.
  if (!resolved) {
    if (looksLikeHtmlPortalUrl(creds.docsUrl)) {
      return NextResponse.redirect(creds.docsUrl);
    }

    return new NextResponse(
      [
        'Could not load an OpenAPI/Swagger specification for this connection.',
        '',
        `Configured docs URL: ${creds.docsUrl}`,
        '',
        'Set API Documentation to an OpenAPI JSON/YAML URL (for example …/v3/api-docs),',
        'or to a public documentation portal page (…/swagger-ui/index.html).',
      ].join('\n'),
      { status: 502, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  }

  const specUrl = `/api/connections/${id}/docs/spec`;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>API Documentation</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; padding: 0; }
    #swagger-ui { max-width: 1400px; margin: 0 auto; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: ${JSON.stringify(specUrl)},
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: 'BaseLayout',
      requestInterceptor: function(req) {
        // Authenticate "Try it out" calls against the provider API.
        if (req.url && req.url.indexOf('/api/connections/') !== 0) {
          req.headers['Authorization'] = 'Bearer ' + ${JSON.stringify(creds.accessToken)};
        }
        return req;
      },
    });
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-OpenAPI-Source': resolved.sourceUrl,
    },
  });
}
