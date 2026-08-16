type DocxtemplaterErrorLike = {
  message?: string;
  name?: string;
  properties?: {
    id?: string;
    xtag?: string;
    explanation?: string;
    errors?: DocxtemplaterErrorLike[];
  };
};

/**
 * Turns Nest / docxtemplater failures into a single user-facing string.
 * Docxtemplater multi-errors often only expose message "Multi error"; the
 * actionable detail lives on properties.errors[].
 */
export function formatDocumentGenerationError(error: unknown): string {
  if (!error) return 'Document generation failed';

  const err = error as DocxtemplaterErrorLike & {
    response?: { message?: string };
    getErrors?: () => DocxtemplaterErrorLike[];
  };

  const nested =
    err.properties?.errors ??
    (typeof err.getErrors === 'function' ? err.getErrors() : undefined);

  if (Array.isArray(nested) && nested.length > 0) {
    const parts = nested.map(formatSingleTemplateError).filter(Boolean);
    if (parts.length === 1) return parts[0]!;
    if (parts.length > 1) {
      return `Template has ${parts.length} errors:\n${parts.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;
    }
  }

  const single = formatSingleTemplateError(err);
  if (single) return single;

  if (typeof err.message === 'string' && err.message.trim()) {
    if (err.message === 'Multi error') {
      return 'Document template error (see template tags / table structure)';
    }
    return err.message;
  }

  return 'Document generation failed';
}

function formatSingleTemplateError(err: DocxtemplaterErrorLike): string | null {
  const props = err.properties;
  const message = err.message?.trim();
  const explanation = props?.explanation?.trim();
  const xtag = props?.xtag?.trim();
  const id = props?.id?.trim();

  if (!message && !explanation) return null;

  const lines: string[] = [];
  if (message && message !== 'Multi error') {
    lines.push(message);
  }
  if (explanation && explanation !== message) {
    lines.push(explanation);
  }
  if (xtag || id) {
    const meta = [xtag ? `tag: ${xtag}` : null, id ? `code: ${id}` : null]
      .filter(Boolean)
      .join(', ');
    if (meta) lines.push(`(${meta})`);
  }

  return lines.length > 0 ? lines.join('\n') : null;
}
