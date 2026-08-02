export const FEATURES = {
  AI_CHAT: 'ai.chat',
  AI_AGENTS: 'ai.agents',
  AI_SKILLS: 'ai.skills',
  AI_CONNECTIONS: 'ai.connections',
} as const;

export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];

/**
 * Soft-fail: when the session has no feature claims (legacy tokens / RBAC
 * not yet seeded), treat features as enabled so AI nav stays usable.
 * Once features are present on the JWT, enforce the allowlist.
 */
export function hasFeature(features: string[] | undefined, key: string): boolean {
  if (!features || features.length === 0) return true;
  for (const held of features) {
    if (held === '*') return true;
    if (held === key) return true;
    if (held.endsWith('.*')) {
      const prefix = held.slice(0, -1);
      if (key.startsWith(prefix)) return true;
    }
  }
  return false;
}
