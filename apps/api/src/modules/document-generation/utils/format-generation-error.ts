type DocxTemplatesErrorLike = {
  message?: string;
  name?: string;
};

/**
 * Turns docx-templates failures into a single user-facing string.
 */
export function formatDocumentGenerationError(error: unknown): string {
  if (!error) return 'Document generation failed';

  if (Array.isArray(error)) {
    const parts = error
      .map((item) => formatDocumentGenerationError(item))
      .filter((msg) => msg && msg !== 'Document generation failed');
    if (parts.length === 1) return parts[0]!;
    if (parts.length > 1) {
      return `Template has ${parts.length} errors:\n${parts.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;
    }
  }

  const err = error as DocxTemplatesErrorLike & { response?: { message?: string } };
  const message = err.message?.trim();
  const name = err.name?.trim();

  if (message) {
    if (name && !message.includes(name)) {
      return `${name}: ${message}`;
    }
    return message;
  }

  if (err.response?.message?.trim()) {
    return err.response.message.trim();
  }

  return 'Document generation failed';
}
