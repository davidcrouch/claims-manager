import type { SkillMatchResult } from './skill.types';

/**
 * Generates the skill prompt block that gets injected into the system prompt
 * before inference, informing the agent about available skills.
 */
export function buildSkillPromptBlock(matches: SkillMatchResult[]): string {
  if (matches.length === 0) return '';

  const pinnedSkills = matches.filter((m) => m.source === 'pinned');
  const semanticSkills = matches.filter((m) => m.source === 'semantic' || m.source === 'keyword');

  const lines: string[] = [];
  lines.push('\n\n## Available Skills');
  lines.push(
    'You have access to specialized AI skills that can help you with specific tasks. ' +
      'When a skill is relevant to the user request, follow its instructions carefully.',
  );

  if (pinnedSkills.length > 0) {
    lines.push('\n### Always-Available Skills (Pinned)');
    lines.push('These skills are always available for this conversation:');
    for (const { skill } of pinnedSkills) {
      lines.push(formatSkillEntry(skill));
    }
  }

  if (semanticSkills.length > 0) {
    lines.push('\n### Contextually Relevant Skills');
    lines.push('These skills were identified as potentially relevant to the current message:');
    for (const { skill, similarity } of semanticSkills) {
      lines.push(formatSkillEntry(skill, similarity));
    }
  }

  return lines.join('\n');
}

function formatSkillEntry(
  skill: { id: string; name: string; description?: string | null; category?: string | null; triggerHints: string[] },
  similarity?: number,
): string {
  let entry = `- **${skill.name}** (ID: \`${skill.id}\`)`;
  if (skill.category) entry += ` [${skill.category}]`;
  if (similarity !== undefined) entry += ` — relevance: ${(similarity * 100).toFixed(0)}%`;
  entry += `\n  ${skill.description ?? 'No description'}`;
  if (skill.triggerHints && skill.triggerHints.length > 0) {
    entry += `\n  _Useful for: ${skill.triggerHints.join(', ')}_`;
  }
  return entry;
}
