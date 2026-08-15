/**
 * Pure helpers for matching pack enabledTools patterns against MCP tool names.
 * Kept dependency-free for unit tests.
 */

export function compileToolNamePattern(pattern: string): (name: string) => boolean {
  if (!pattern.includes('*')) {
    return (name) => name === pattern;
  }
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  const re = new RegExp(`^${escaped}$`);
  return (name) => re.test(name);
}

/**
 * Expand tool name patterns against a flat list of tool names.
 * Returns unique matching tool names (not namespaced).
 */
export function matchToolNames(params: {
  toolNames: string[];
  patterns: string[];
}): string[] {
  if (!params.patterns.length) return [];
  const out = new Set<string>();
  for (const pattern of params.patterns) {
    const matcher = compileToolNamePattern(pattern);
    for (const name of params.toolNames) {
      if (matcher(name)) out.add(name);
    }
  }
  return [...out];
}
