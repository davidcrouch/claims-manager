import { Logger } from '@nestjs/common';
import type { SkillConfig } from '../../skills/skill.types';
import {
  createProvider,
  resolveModelLocation,
  type ChatProviderId,
} from '../providers/model-router';
import type { ProviderToolDefinition, TokenUsage } from '../providers/types';
import { streamCompletion } from './stream-completion';

const LOG_PREFIX = 'SkillIsolatedRunner';
const logger = new Logger('SkillIsolatedRunner');

const ISOLATED_TIMEOUT_MS = 15_000;
const MAX_ISOLATED_TOKENS = 4096;

export interface IsolatedRunResult {
  activated: true;
  mode: 'isolated';
  skillId: string;
  skillName: string;
  result: unknown;
  tokenUsage?: { input: number; output: number };
  timeMs: number;
}

export interface IsolatedRunContext {
  gcpProjectId: string;
  vertexLocation: string;
  parentModel: string;
  parentProvider: string;
  tools: Record<string, ProviderToolDefinition>;
}

/**
 * Runs a skill in isolation as a separate sub-completion.
 *
 * The skill gets its own system prompt, model/temperature settings,
 * and optionally a subset of tools. Results are returned as structured
 * data to the parent agent.
 */
export async function runSkillIsolated(
  skill: SkillConfig,
  input: { reason?: string; message?: string; data?: Record<string, unknown> },
  context: IsolatedRunContext,
): Promise<IsolatedRunResult> {
  const startTime = Date.now();

  const model = skill.modelOverride ?? context.parentModel;
  const providerType: ChatProviderId = model.startsWith('claude')
    ? 'vertex-anthropic'
    : 'vertex-gemini';

  const location = resolveModelLocation(
    providerType,
    model,
    { primary: context.vertexLocation, extended: context.vertexLocation },
  );

  const provider = createProvider(
    providerType,
    model,
    context.gcpProjectId,
    location,
  );

  const instructions = buildIsolatedPrompt(skill, input);
  const messageId = `skill_${skill.id}_${Date.now()}`;

  const messages: Array<{ role: 'user' | 'assistant'; content: Array<{ type: 'text'; text: string }> }> = [];
  if (input.message) {
    messages.push({ role: 'user', content: [{ type: 'text', text: input.message }] });
  } else if (input.reason) {
    messages.push({ role: 'user', content: [{ type: 'text', text: input.reason }] });
  }

  const relevantTools = resolveSkillTools(skill, context.tools);

  try {
    let resultText = '';
    let totalUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 };

    const events = streamCompletion({
      provider,
      request: {
        model,
        instructions,
        messages,
        temperature: 0.3,
        maxOutputTokens: MAX_ISOLATED_TOKENS,
      },
      tools: relevantTools,
      maxSteps: 5,
      messageId,
    });

    for await (const event of events) {
      if (event.type === 'text-delta') {
        resultText += event.delta;
      }
      if (event.type === 'finish') {
        totalUsage = event.totalUsage;
      }
    }

    const timeMs = Date.now() - startTime;

    let parsedResult: unknown = resultText;
    if (skill.outputSchema) {
      try {
        parsedResult = JSON.parse(resultText);
      } catch {
        parsedResult = { rawText: resultText };
      }
    }

    logger.log(
      `[${LOG_PREFIX}.runSkillIsolated] completed skillId=${skill.id} model=${model} timeMs=${timeMs} inputTokens=${totalUsage.inputTokens} outputTokens=${totalUsage.outputTokens}`,
    );

    return {
      activated: true,
      mode: 'isolated',
      skillId: skill.id,
      skillName: skill.name,
      result: parsedResult,
      tokenUsage: { input: totalUsage.inputTokens, output: totalUsage.outputTokens },
      timeMs,
    };
  } catch (err) {
    const timeMs = Date.now() - startTime;
    logger.error(
      `[${LOG_PREFIX}.runSkillIsolated] failed skillId=${skill.id} error=${err instanceof Error ? err.message : String(err)} timeMs=${timeMs}`,
    );

    return {
      activated: true,
      mode: 'isolated',
      skillId: skill.id,
      skillName: skill.name,
      result: { error: true, message: `Skill execution failed: ${err instanceof Error ? err.message : String(err)}` },
      timeMs,
    };
  }
}

function buildIsolatedPrompt(
  skill: SkillConfig,
  input: { reason?: string; data?: Record<string, unknown> },
): string {
  const parts: string[] = [
    `You are executing the "${skill.name}" skill.`,
    '',
    skill.instructionPrompt,
  ];

  if (skill.outputSchema) {
    parts.push(
      '',
      '## Output Format',
      'Respond with valid JSON matching this schema:',
      '```json',
      JSON.stringify(skill.outputSchema, null, 2),
      '```',
    );
  }

  if (input.data && Object.keys(input.data).length > 0) {
    parts.push(
      '',
      '## Input Data',
      '```json',
      JSON.stringify(input.data, null, 2),
      '```',
    );
  }

  return parts.join('\n');
}

function resolveSkillTools(
  skill: SkillConfig,
  availableTools: Record<string, ProviderToolDefinition>,
): Record<string, ProviderToolDefinition> {
  if (skill.requiredToolRefs.length === 0) return {};

  const resolved: Record<string, ProviderToolDefinition> = {};
  const requiredToolNames = skill.requiredToolRefs.map((ref: { integration: string; tool: string }) => ref.tool);

  for (const toolName of requiredToolNames) {
    if (availableTools[toolName]) {
      resolved[toolName] = availableTools[toolName];
    } else {
      const fallbackKey = Object.keys(availableTools).find(
        (k) => k.endsWith(`__${toolName}`) || k.includes(`_${toolName}`),
      );
      if (fallbackKey) {
        resolved[toolName] = availableTools[fallbackKey];
      }
    }
  }
  return resolved;
}
