import React from 'react';
import { renderToString } from 'react-dom/server';

interface RenderPageOptions {
  title?: string;
  description?: string;
}

export function renderPage(
  component: React.ReactElement,
  options: RenderPageOptions = {}
): string {
  const { title = 'EnsureOS', description = '' } = options;
  const body = renderToString(component);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  ${description ? `<meta name="description" content="${escapeHtml(description)}">` : ''}
  <link rel="icon" type="image/png" href="/ensure_logo.png">
  <link rel="apple-touch-icon" href="/ensure_logo.png">
  <link rel="stylesheet" href="/styles.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
  ${body}
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
