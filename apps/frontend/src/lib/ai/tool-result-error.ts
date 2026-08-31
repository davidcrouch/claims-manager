import type { ChatPart, ToolCallPart, ToolResultPart } from './chat-types';

export function isToolResultError(
  result: unknown,
  isErrorFlag?: boolean,
): boolean {
  if (isErrorFlag) return true;
  if (!result || typeof result !== 'object' || Array.isArray(result)) return false;
  const obj = result as Record<string, unknown>;
  if (obj.error === true) return true;
  if (typeof obj.error === 'string' && obj.error.trim().length > 0) return true;
  return false;
}

export function toolResultErrorMessage(result: unknown): string | undefined {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return typeof result === 'string' && result.trim() ? result : undefined;
  }
  const obj = result as Record<string, unknown>;
  if (typeof obj.message === 'string' && obj.message.trim()) return obj.message;
  if (typeof obj.error === 'string' && obj.error.trim()) return obj.error;
  return undefined;
}

export function findToolResultPart(
  parts: ChatPart[],
  toolCallId: string,
): ToolResultPart | undefined {
  return parts.find(
    (p): p is ToolResultPart =>
      p.type === 'tool-result' && p.toolCallId === toolCallId,
  );
}

export function isToolCallFailure(
  part: ToolCallPart,
  resultPart: ToolResultPart | undefined,
): boolean {
  if (part.state === 'error') return true;
  if (!resultPart) return false;
  return isToolResultError(resultPart.result, resultPart.isError);
}

export function messageHasToolErrors(parts: ChatPart[]): boolean {
  for (const part of parts) {
    if (part.type === 'tool-call' && isToolCallFailure(part, findToolResultPart(parts, part.toolCallId))) {
      return true;
    }
    if (part.type === 'tool-result' && isToolResultError(part.result, part.isError)) {
      return true;
    }
  }
  return false;
}

/** Hide recovered tool failures in the timeline; show them only when the turn terminated. */
export function shouldShowToolCallInTimeline(
  part: ToolCallPart,
  parts: ChatPart[],
  processTerminated: boolean,
): boolean {
  if (part.state === 'pending') return true;
  if (!isToolCallFailure(part, findToolResultPart(parts, part.toolCallId))) return true;
  return processTerminated;
}
