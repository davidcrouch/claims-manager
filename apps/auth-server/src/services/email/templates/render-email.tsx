import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export function renderEmailHtml(element: React.ReactElement): string {
  return `<!DOCTYPE html>${renderToStaticMarkup(element)}`;
}
