import { Logger } from '@nestjs/common';
import { sanitizeToolArgsForContext } from '../prompt-sanitizer';
import type {
  CompletionProvider,
  CompletionRequest,
  ProviderContent,
  ProviderToolDefinition,
  ToolCall,
  TokenUsage,
} from '../providers/types';
import type { SSEEvent } from './types';

const logger = new Logger('StreamCompletion');

/** After this many consecutive tool-only model turns, force a text reply to the user. */
const DEFAULT_PAUSE_AFTER_TOOL_STEPS = 4;

const PAUSE_NUDGE =
  'Stop calling tools for now. Reply to the user with: ' +
  '(1) what you just did and observed, ' +
  '(2) a short summary of the current state, ' +
  '(3) what you need from them next (confirmation, details, or next action). ' +
  'Do not call any tools in this response. ' +
  'When they reply, continue from where you left off.';

const AUTONOMOUS_PAUSE_NUDGE =
  'Briefly report your progress to the user: ' +
  '(1) what you have completed so far, ' +
  '(2) what remains, ' +
  '(3) your current focus. ' +
  'Do not call any tools in this response. Do not ask for permission — just report. ' +
  'When the user replies, immediately continue with the next tool calls.';

const LIMIT_NUDGE =
  'You have reached the tool-step limit for this turn. ' +
  'Summarise progress so far and tell the user exactly what to reply so you can continue. ' +
  'Do not call any tools. ' +
  'When they reply, continue from where you left off.';

const EMPTY_AFTER_TOOLS_NUDGE =
  'The tool results above are available. Continue the task: call the next tool now, ' +
  'or reply with your final answer if the work is complete. Do not claim you are waiting for tool results.';

const MAX_EMPTY_RETRIES = 2;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isSoftToolError(result: unknown): boolean {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return false;
  const obj = result as Record<string, unknown>;
  if (obj.error === true) return true;
  if (typeof obj.error === 'string' && obj.error.trim().length > 0) return true;
  return false;
}

function softToolErrorMessage(result: unknown): string | undefined {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return undefined;
  const obj = result as Record<string, unknown>;
  if (typeof obj.message === 'string' && obj.message.trim()) return obj.message.slice(0, 240);
  if (typeof obj.error === 'string' && obj.error.trim()) return obj.error.slice(0, 240);
  return undefined;
}

function toUserFacingProviderError(err: unknown): string {
  const message = errorMessage(err);
  const modelMatch = message.match(/models\/([^/`\s]+)/);
  if (message.includes('404') || message.includes('NOT_FOUND')) {
    const model = modelMatch?.[1];
    if (model) {
      return `The AI model "${model}" is not available in this region or project. Update the agent model in Settings.`;
    }
    return 'The configured AI model is not available. Update the agent model in Settings.';
  }
  return message.length > 500 ? `${message.slice(0, 500)}…` : message;
}

export interface StreamCompletionOptions {
  provider: CompletionProvider;
  request: CompletionRequest;
  tools: Record<string, ProviderToolDefinition>;
  maxSteps?: number;
  pauseAfterToolSteps?: number;
  autonomousMode?: boolean;
  maxDurationMs?: number;
  messageId: string;
  /** If set, re-read instructions before each provider step (e.g. after inline skill activation). */
  getInstructions?: () => string;
  onToolCall?: (toolCall: ToolCall) => void;
  onToolResult?: (toolCallId: string, toolName: string, result: unknown, isError: boolean) => void;
}

export async function* streamCompletion(opts: StreamCompletionOptions): AsyncGenerator<SSEEvent> {
  const {
    provider,
    request,
    tools,
    maxSteps = 10,
    pauseAfterToolSteps = DEFAULT_PAUSE_AFTER_TOOL_STEPS,
    autonomousMode = false,
    maxDurationMs = 120_000,
    messageId,
  } = opts;

  const startTime = Date.now();
  let step = 0;
  let consecutiveToolSteps = 0;
  let emptyRetries = 0;
  let totalUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
  let streamError: string | undefined;
  let currentRequest: CompletionRequest = { ...request };
  let executedToolsThisRequest = false;

  if (Object.keys(tools).length > 0) {
    currentRequest.tools = Object.values(tools);
  }

  while (step < maxSteps) {
    const elapsed = Date.now() - startTime;
    if (elapsed > maxDurationMs) {
      logger.warn(`[StreamCompletion.streamCompletion] duration limit exceeded at step ${step}`);
      yield { type: 'error', message: 'Stream duration limit exceeded', code: 'DURATION_LIMIT' };
      break;
    }

    step++;
    const stepStart = Date.now();
    if (opts.getInstructions) {
      currentRequest.instructions = opts.getInstructions();
    }
    // Re-read tools each step so inline skill activation can add required tools mid-turn.
    currentRequest.tools =
      Object.keys(tools).length > 0 ? Object.values(tools) : undefined;
    yield { type: 'step-start', step, model: currentRequest.model };

    const pendingToolCalls: ToolCall[] = [];
    let stepUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
    let emittedText = false;

    try {
      for await (const chunk of provider.stream(currentRequest)) {
        switch (chunk.type) {
          case 'text-delta':
            emittedText = true;
            yield { type: 'text-delta', delta: chunk.delta };
            break;

          case 'reasoning-delta':
            yield { type: 'reasoning-delta', delta: chunk.delta };
            break;

          case 'tool-call':
            pendingToolCalls.push(chunk.toolCall);
            yield {
              type: 'tool-call',
              toolCallId: chunk.toolCall.id,
              toolName: chunk.toolCall.name,
              args: chunk.toolCall.args,
              thoughtSignature: chunk.toolCall.thoughtSignature,
            };
            break;

          case 'usage':
            stepUsage = chunk.usage;
            break;

          case 'finish':
            break;
        }
      }
    } catch (err) {
      const rawMessage = errorMessage(err);
      const message = toUserFacingProviderError(err);
      streamError = message;
      logger.error(`[StreamCompletion.streamCompletion] provider stream error: ${rawMessage}`);
      yield { type: 'error', message, code: 'PROVIDER_ERROR' };
      break;
    }

    totalUsage = {
      inputTokens: totalUsage.inputTokens + stepUsage.inputTokens,
      outputTokens: totalUsage.outputTokens + stepUsage.outputTokens,
    };

    yield { type: 'usage', inputTokens: stepUsage.inputTokens, outputTokens: stepUsage.outputTokens, step };

    if (pendingToolCalls.length === 0) {
      yield {
        type: 'step-end',
        step,
        durationMs: Date.now() - stepStart,
        usage: stepUsage,
      };

      if (autonomousMode && executedToolsThisRequest && consecutiveToolSteps < pauseAfterToolSteps && step < maxSteps) {
        currentRequest = {
          ...currentRequest,
          messages: [
            ...currentRequest.messages,
            { role: 'assistant', content: [{ type: 'text', text: emittedText ? '(progress reported)' : '' }] },
            { role: 'user', content: [{ type: 'text', text: 'Continue. Call the next tool immediately. Do not output text without a tool call.' }] },
          ],
        };
        consecutiveToolSteps = 0;
        continue;
      }

      if (executedToolsThisRequest && !emittedText && !streamError && emptyRetries < MAX_EMPTY_RETRIES && step < maxSteps) {
        emptyRetries++;
        currentRequest = {
          ...currentRequest,
          messages: [
            ...currentRequest.messages,
            { role: 'user', content: [{ type: 'text', text: EMPTY_AFTER_TOOLS_NUDGE }] },
          ],
        };
        continue;
      }

      if (executedToolsThisRequest && !emittedText && !streamError) {
        yield* forceTextReply({
          provider,
          currentRequest,
          nudge: `${EMPTY_AFTER_TOOLS_NUDGE} Reply to the user with what you observed and what you will do next.`,
          stepRef: { step },
          onUsage: (u) => {
            totalUsage = {
              inputTokens: totalUsage.inputTokens + u.inputTokens,
              outputTokens: totalUsage.outputTokens + u.outputTokens,
            };
          },
          onError: (message) => {
            streamError = message;
          },
        });
      }
      break;
    }

    consecutiveToolSteps++;
    executedToolsThisRequest = true;
    emptyRetries = 0;

    const assistantContent: ProviderContent[] = pendingToolCalls.map((toolCall) => ({
      type: 'tool-call' as const,
      id: toolCall.id,
      name: toolCall.name,
      args: sanitizeToolArgsForContext(toolCall.args),
      thoughtSignature: toolCall.thoughtSignature,
    }));

    const toolResultContents: ProviderContent[] = [];

    for (const toolCall of pendingToolCalls) {
      let toolDef = tools[toolCall.name];

      if (!toolDef) {
        const fallbackKey = Object.keys(tools).find((k) => k.endsWith(`__${toolCall.name}`));
        if (fallbackKey) {
          toolDef = tools[fallbackKey];
        }
      }

      let result: unknown;
      let isError = false;

      if (!toolDef) {
        result = { error: true, message: `Tool "${toolCall.name}" not found` };
        isError = true;
        logger.warn(`[StreamCompletion.streamCompletion] tool "${toolCall.name}" not found`);
      } else {
        try {
          opts.onToolCall?.(toolCall);
          result = await toolDef.execute(toolCall.args);
        } catch (err) {
          const errMsg = errorMessage(err);
          result = {
            error: true,
            message: errMsg,
            hint: 'Try adding a limit parameter, using pagination, or narrowing your search filters.',
          };
          isError = true;
          logger.warn(`[StreamCompletion.streamCompletion] tool "${toolCall.name}" failed: ${errMsg}`);
        }
        if (!isError && isSoftToolError(result)) {
          isError = true;
          const detail = softToolErrorMessage(result);
          logger.warn(
            `[StreamCompletion.streamCompletion] tool "${toolCall.name}" returned error payload${detail ? `: ${detail}` : ''}`,
          );
        }
      }

      opts.onToolResult?.(toolCall.id, toolCall.name, result, isError);

      yield {
        type: 'tool-result',
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        result,
        isError: isError || undefined,
      };

      if (!isError && toolDef?.resourceUri) {
        yield {
          type: 'mcp-app',
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          resourceUri: toolDef.resourceUri,
          part: { args: toolCall.args, result },
        };
      }

      toolResultContents.push({
        type: 'tool-result',
        toolCallId: toolCall.id,
        name: toolCall.name,
        result,
        isError: isError || undefined,
      });
    }

    yield {
      type: 'step-end',
      step,
      durationMs: Date.now() - stepStart,
      usage: stepUsage,
    };

    currentRequest = {
      ...currentRequest,
      messages: [
        ...currentRequest.messages,
        { role: 'assistant', content: assistantContent },
        { role: 'user', content: toolResultContents },
      ],
    };

    const hitStepLimit = step >= maxSteps;
    const hitPauseCheckpoint = consecutiveToolSteps >= pauseAfterToolSteps;

    if ((hitStepLimit || hitPauseCheckpoint) && !streamError) {
      const nudge = hitStepLimit
        ? LIMIT_NUDGE
        : autonomousMode
          ? AUTONOMOUS_PAUSE_NUDGE
          : PAUSE_NUDGE;

      yield* forceTextReply({
        provider,
        currentRequest,
        nudge,
        stepRef: { step },
        onUsage: (u) => {
          totalUsage = {
            inputTokens: totalUsage.inputTokens + u.inputTokens,
            outputTokens: totalUsage.outputTokens + u.outputTokens,
          };
        },
        onError: (message) => {
          streamError = message;
        },
      });
      break;
    }
  }

  if (!streamError) {
    yield {
      type: 'finish',
      messageId,
      totalUsage,
      durationMs: Date.now() - startTime,
    };
  }
}

async function* forceTextReply(opts: {
  provider: CompletionProvider;
  currentRequest: CompletionRequest;
  nudge: string;
  stepRef: { step: number };
  onUsage: (usage: TokenUsage) => void;
  onError: (message: string) => void;
}): AsyncGenerator<SSEEvent> {
  opts.stepRef.step += 1;
  const step = opts.stepRef.step;
  const stepStart = Date.now();
  yield { type: 'step-start', step, model: opts.currentRequest.model };

  const textRequest: CompletionRequest = {
    ...opts.currentRequest,
    tools: undefined,
    messages: [
      ...opts.currentRequest.messages,
      { role: 'user', content: [{ type: 'text', text: opts.nudge }] },
    ],
  };

  let stepUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
  let gotText = false;

  try {
    for await (const chunk of opts.provider.stream(textRequest)) {
      switch (chunk.type) {
        case 'text-delta':
          gotText = true;
          yield { type: 'text-delta', delta: chunk.delta };
          break;
        case 'reasoning-delta':
          yield { type: 'reasoning-delta', delta: chunk.delta };
          break;
        case 'tool-call':
          logger.warn('[StreamCompletion.forceTextReply] model attempted tool call with tools disabled');
          break;
        case 'usage':
          stepUsage = chunk.usage;
          break;
        case 'finish':
          break;
      }
    }
  } catch (err) {
    const rawMessage = errorMessage(err);
    const message = toUserFacingProviderError(err);
    logger.error(`[StreamCompletion.forceTextReply] provider error: ${rawMessage}`);
    opts.onError(message);
    yield { type: 'error', message, code: 'PROVIDER_ERROR' };
    return;
  }

  if (!gotText) {
    yield {
      type: 'text-delta',
      delta:
        "I've completed several tool steps. Reply with what you'd like me to do next " +
        '(e.g. continue, provide details, or finish).',
    };
  }

  opts.onUsage(stepUsage);
  yield { type: 'usage', inputTokens: stepUsage.inputTokens, outputTokens: stepUsage.outputTokens, step };
  yield {
    type: 'step-end',
    step,
    durationMs: Date.now() - stepStart,
    usage: stepUsage,
  };
}
