import type { SkillConfig, SkillInvocationMode } from './skill.types';

/**
 * Determines whether a skill should be invoked inline (mutating the current
 * conversation context) or isolated (as a separate sub-completion).
 *
 * Rules:
 * - Explicit invocationMode on skill overrides everything
 * - If skill specifies a different model → isolated
 * - If skill output format is "structured" → isolated
 * - If skill does NOT require conversation history → isolated
 * - Otherwise → inline
 */
export function resolveInvocationMode(
  skill: SkillConfig,
  parentModel?: string,
): SkillInvocationMode {
  if (skill.invocationMode === 'isolated') {
    return 'isolated';
  }

  if (skill.invocationMode === 'inline') {
    return 'inline';
  }

  if (skill.modelOverride && skill.modelOverride !== parentModel) {
    return 'isolated';
  }

  if (skill.outputSchema) {
    return 'isolated';
  }

  if (!skill.includeHistory) {
    return 'isolated';
  }

  return 'inline';
}
