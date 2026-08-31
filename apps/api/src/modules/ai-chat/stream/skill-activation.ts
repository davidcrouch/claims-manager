import { Logger } from '@nestjs/common';
import type { SkillConfig } from '../../skills/skill.types';
import { resolveInvocationMode } from '../../skills/skill-router';
import type { ProviderMessage, ProviderToolDefinition } from '../providers/types';
import { injectSkillInline } from './skill-inline-injector';
import {
  runSkillIsolated,
  type IsolatedRunContext,
} from './skill-isolated-runner';

const LOG = 'SkillActivation';
const logger = new Logger(LOG);

export const ACTIVATE_SKILL_TOOL_NAME = 'activate_skill';

export interface SkillActivationContext {
  /** Skills the agent may activate this turn (matched + pinned). */
  skillsById: Map<string, SkillConfig>;
  parentModel: string;
  getInstructions: () => string;
  setInstructions: (next: string) => void;
  /**
   * Mutable parent tool map for this turn. Inline activation merges the
   * skill's required tools into this object so the model can call them next.
   */
  parentTools: Record<string, ProviderToolDefinition>;
  /** Full MCP tool set (unfiltered) used to resolve skill requiredToolRefs. */
  allTools: Record<string, ProviderToolDefinition>;
  isolated: IsolatedRunContext;
  /** Recent conversation messages for isolated skills with includeHistory. */
  historyMessages: ProviderMessage[];
  extractLastUserMessage: () => string;
}

/**
 * Built-in tool the chat agent calls to activate a matched skill.
 * Dispatches to inline injection or isolated sub-completion via skill-router.
 */
export function createActivateSkillTool(
  ctx: SkillActivationContext,
): ProviderToolDefinition {
  return {
    name: ACTIVATE_SKILL_TOOL_NAME,
    description:
      'Activate a specialized skill by ID. Call this when a listed Available Skill is relevant. ' +
      'Inline skills add instructions to this turn; isolated skills run as a sub-task and return a result.',
    inputSchema: {
      type: 'object',
      properties: {
        skillId: {
          type: 'string',
          description: 'Skill UUID from the Available Skills list',
        },
        reason: {
          type: 'string',
          description: 'Brief reason for activating this skill',
        },
        data: {
          type: 'object',
          description: 'Optional structured input for the skill',
          additionalProperties: true,
        },
      },
      required: ['skillId'],
    },
    execute: async (args) => activateSkill(ctx, args),
  };
}

async function activateSkill(
  ctx: SkillActivationContext,
  args: Record<string, unknown>,
): Promise<unknown> {
  const skillId = typeof args.skillId === 'string' ? args.skillId.trim() : '';
  if (!skillId) {
    return { error: true, message: 'skillId is required', skillId: null };
  }

  const skill = ctx.skillsById.get(skillId);
  if (!skill) {
    return {
      error: true,
      message: `Skill "${skillId}" is not available in this turn. Use an ID from Available Skills.`,
      skillId,
    };
  }

  const reason = typeof args.reason === 'string' ? args.reason : undefined;
  const data =
    args.data && typeof args.data === 'object' && !Array.isArray(args.data)
      ? (args.data as Record<string, unknown>)
      : undefined;

  const mode = resolveInvocationMode(skill, ctx.parentModel);
  logger.log(
    `[${LOG}.activateSkill] skillId=${skill.id} name=${skill.name} mode=${mode}`,
  );

  if (mode === 'isolated') {
    const message = ctx.extractLastUserMessage() || reason;
    return runSkillIsolated(
      skill,
      { reason, message, data },
      {
        ...ctx.isolated,
        historyMessages: skill.includeHistory
          ? sliceHistory(ctx.historyMessages, skill.historyMessageCount ?? 5)
          : undefined,
      },
    );
  }

  const injectedToolCount = mergeSkillToolsIntoParent(
    skill,
    ctx.parentTools,
    ctx.allTools,
  );
  const { updatedInstructions, result } = injectSkillInline(
    skill,
    ctx.getInstructions(),
  );
  ctx.setInstructions(updatedInstructions);
  return {
    ...result,
    injectedTools: injectedToolCount,
    reason: reason ?? null,
    guidance:
      'Skill instructions and required tools are now active for this turn. ' +
      'Call the skill tools next (for example open_create_assessment). Do not claim a form is open until the tool succeeds.',
  };
}

/**
 * Adds a skill's required tools into the parent allowlisted tool map.
 * Returns how many tools were newly added.
 */
export function mergeSkillToolsIntoParent(
  skill: SkillConfig,
  parentTools: Record<string, ProviderToolDefinition>,
  allTools: Record<string, ProviderToolDefinition>,
): number {
  let added = 0;
  for (const ref of skill.requiredToolRefs) {
    const toolName = ref.tool;
    const alreadyPresent = Object.keys(parentTools).some(
      (k) => k === toolName || k.endsWith(`__${toolName}`),
    );
    if (alreadyPresent) continue;

    const matchedKey = Object.keys(allTools).find(
      (k) => k === toolName || k.endsWith(`__${toolName}`),
    );
    if (!matchedKey) {
      logger.warn(
        `[${LOG}.mergeSkillToolsIntoParent] required tool not found: ${toolName}`,
      );
      continue;
    }
    parentTools[matchedKey] = allTools[matchedKey];
    added += 1;
  }
  if (added > 0) {
    logger.log(
      `[${LOG}.mergeSkillToolsIntoParent] skill=${skill.name} added=${added} totalTools=${Object.keys(parentTools).length}`,
    );
  }
  return added;
}

function sliceHistory(
  messages: ProviderMessage[],
  count: number,
): ProviderMessage[] {
  if (count <= 0 || messages.length === 0) return [];
  return messages.slice(-count);
}
