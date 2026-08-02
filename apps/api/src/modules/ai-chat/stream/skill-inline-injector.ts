import { Logger } from '@nestjs/common';
import type { SkillConfig } from '../../skills/skill.types';

const LOG_PREFIX = 'SkillInlineInjector';
const logger = new Logger('SkillInlineInjector');

export interface InlineInjectionResult {
  activated: true;
  mode: 'inline';
  skillId: string;
  skillName: string;
  injectedInstructions: boolean;
  injectedTools: number;
}

/**
 * Handles inline skill activation by mutating the current request context.
 *
 * In inline mode:
 * - The skill's instructionPrompt is appended to the current system instructions
 * - The skill's requiredToolRefs are noted for tool filtering
 * - The agent continues the conversation with enhanced context
 */
export function injectSkillInline(
  skill: SkillConfig,
  currentInstructions: string,
): { updatedInstructions: string; result: InlineInjectionResult } {
  const skillBlock = [
    `\n\n## Active Skill: ${skill.name}`,
    `The following skill has been activated. Follow these instructions to complete the task:`,
    '',
    skill.instructionPrompt,
  ].join('\n');

  const updatedInstructions = currentInstructions + skillBlock;

  logger.log(
    `[${LOG_PREFIX}.injectSkillInline] skill injected inline skillId=${skill.id} skillName=${skill.name} toolsRequired=${skill.requiredToolRefs.length}`,
  );

  return {
    updatedInstructions,
    result: {
      activated: true,
      mode: 'inline',
      skillId: skill.id,
      skillName: skill.name,
      injectedInstructions: true,
      injectedTools: skill.requiredToolRefs.length,
    },
  };
}
