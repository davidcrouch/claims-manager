export interface VisionAnnotation {
  label: string;
  confidence: number;
  boundingBox: { x: number; y: number; width: number; height: number };
}

export interface VisionBlockSpec {
  imageUrl?: string;
  imageUri?: string;
  annotations: VisionAnnotation[];
}

export function isVisionBlockSpec(value: unknown): value is VisionBlockSpec {
  if (!value || typeof value !== 'object') return false;
  const spec = value as Record<string, unknown>;
  return Array.isArray(spec.annotations);
}

export function parseVisionBlock(raw: string): VisionBlockSpec | null {
  try {
    const parsed = JSON.parse(raw.trim()) as unknown;
    if (!isVisionBlockSpec(parsed)) return null;
    return {
      imageUrl: typeof parsed.imageUrl === 'string' ? parsed.imageUrl : undefined,
      imageUri: typeof parsed.imageUri === 'string' ? parsed.imageUri : undefined,
      annotations: parsed.annotations.map((ann) => ({
        label: ann.label,
        confidence: typeof ann.confidence === 'number' ? ann.confidence : 0.9,
        boundingBox: ann.boundingBox,
      })),
    };
  } catch {
    return null;
  }
}

export function resolveVisionImageUrl(
  spec: VisionBlockSpec,
  attachmentUrlsByUri: Map<string, string>,
): string | null {
  if (spec.imageUrl && !spec.imageUrl.startsWith('data:')) {
    return spec.imageUrl;
  }
  if (spec.imageUri) {
    return attachmentUrlsByUri.get(spec.imageUri) ?? spec.imageUrl ?? null;
  }
  return spec.imageUrl ?? null;
}

export function buildAttachmentUrlMap(
  messages: Array<{ parts: Array<{ type: string; uri?: string; url?: string }> }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const msg of messages) {
    for (const part of msg.parts) {
      if (part.type !== 'file') continue;
      const uri = part.uri ?? (part.url?.startsWith('gs://') ? part.url : undefined);
      if (uri && part.url) {
        map.set(uri, part.url);
      }
    }
  }
  return map;
}
