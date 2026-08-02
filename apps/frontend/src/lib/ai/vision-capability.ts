const NON_VISION_MODEL_PATTERNS = [
  /^text-/i,
  /embed/i,
  /text-bison/i,
];

export function inferSupportsVision(provider: string, model: string): boolean {
  const normalized = model.trim().toLowerCase();
  if (!normalized) return true;

  if (NON_VISION_MODEL_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return false;
  }

  if (provider === 'google') {
    return normalized.includes('gemini');
  }

  if (provider === 'anthropic') {
    return normalized.includes('claude');
  }

  return true;
}

export function agentSupportsVision(
  agent: { supportsVision?: boolean; provider: string; model: string },
): boolean {
  if (typeof agent.supportsVision === 'boolean') {
    return agent.supportsVision;
  }
  return inferSupportsVision(agent.provider, agent.model);
}

export function isImageFilePart(part: { type: string; mediaType?: string }): boolean {
  return part.type === 'file' && (part.mediaType ?? '').startsWith('image/');
}
