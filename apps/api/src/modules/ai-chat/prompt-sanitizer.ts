const BASE64_DATA_URL_RE = /data:[^;]+;base64,[A-Za-z0-9+/=\s]+/gi;
const LONG_BASE64_RE = /[A-Za-z0-9+/=]{500,}/g;
const LONG_BASE64_DETECT_RE = /[A-Za-z0-9+/=]{500,}/;

const MAX_TOOL_ARG_STRING_CHARS = 4000;

function containsLongBase64(value: string): boolean {
  return LONG_BASE64_DETECT_RE.test(value);
}

export function sanitizeTextPrompt(prompt: string, maxChars = 2000): string {
  let cleaned = prompt.replace(BASE64_DATA_URL_RE, '[attached image]');
  cleaned = cleaned.replace(LONG_BASE64_RE, '[binary data removed]');
  cleaned = cleaned.trim();
  if (cleaned.length > maxChars) {
    cleaned = `${cleaned.slice(0, maxChars)}…`;
  }
  return cleaned;
}

/** Shrink tool-call args before they are replayed into the next provider request. */
export function sanitizeToolArgsForContext(
  args: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string') {
      if (value.length > MAX_TOOL_ARG_STRING_CHARS || containsLongBase64(value)) {
        result[key] = sanitizeTextPrompt(value, MAX_TOOL_ARG_STRING_CHARS);
      } else {
        result[key] = value;
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}
