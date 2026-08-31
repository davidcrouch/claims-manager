import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuth } from 'google-auth-library';

const LOG = 'JournalImageGenerationService';
const DEFAULT_GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';
const DEFAULT_GEMINI_LOCATION = 'global';
const DEFAULT_IMAGEN_LOCATION = 'us-central1';
const REQUEST_TIMEOUT_MS = 90_000;
const MAX_QUOTA_RETRIES = 5;
/** Vertex Flash Image capacity 429s are common below ~10s between generateContent calls. */
const MIN_GAP_MS = 10_000;
const QUOTA_BACKOFF_BASE_MS = 8_000;
const QUOTA_BACKOFF_CAP_MS = 45_000;
const QUOTA_BACKOFF_JITTER_MS = 2_000;

export interface GeneratedImage {
  buffer: Buffer;
  mimeType: string;
}

@Injectable()
export class JournalImageGenerationService {
  private readonly logger = new Logger(JournalImageGenerationService.name);
  private readonly auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.projectId());
  }

  async generateInspectionPhoto(prompt: string): Promise<GeneratedImage> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Image generation is not configured. Set GCP_PROJECT_ID or VERTEX_AI_PROJECT.',
      );
    }

    return this.enqueue(async () => {
      const prompts = [this.wrapPrompt(prompt), this.wrapPromptDocumentary(prompt)];
      let lastErr: unknown;
      for (let i = 0; i < prompts.length; i++) {
        try {
          return await this.generateWithGeminiImage(prompts[i]);
        } catch (err) {
          lastErr = err;
          this.logger.warn(
            `[${LOG}.generateInspectionPhoto] attempt=${i + 1} failed — ${this.errorText(err)}`,
          );
          if (this.isQuotaError(err) && i < prompts.length - 1) {
            await this.sleep(this.quotaDelayMs(i + 1));
          }
        }
      }

      const imagenModel = this.imagenModel();
      if (imagenModel) {
        try {
          return await this.generateWithImagen(prompts[0], imagenModel);
        } catch (err) {
          lastErr = err;
        }
      }

      throw new ServiceUnavailableException(
        `Journal image generation failed: ${this.errorText(lastErr)}`,
      );
    });
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn);
    this.chain = run.then(
      async () => {
        await this.sleep(MIN_GAP_MS);
      },
      async () => {
        await this.sleep(MIN_GAP_MS);
      },
    );
    return run;
  }

  private wrapPrompt(prompt: string): string {
    const trimmed = prompt.trim();
    return [
      'Documentary handheld photograph for an Australian residential building insurance claim file.',
      'Show only inanimate building materials and property (roof, walls, glazing, fence, landscaping).',
      'No people, no faces, no blood, no weapons, no graphic injury, no text overlays, no watermarks.',
      'Natural daylight, phone-camera quality, slight grain, suburban house.',
      `Subject: ${trimmed}`,
    ].join(' ');
  }

  /** Softer retry prompt if the first pass is blocked or returns no image. */
  private wrapPromptDocumentary(prompt: string): string {
    const trimmed = prompt
      .trim()
      .replace(/\b(smashed|crushed|destroyed|shattered|violent|gore)\b/gi, 'damaged');
    return [
      'Neutral building-survey photo of property condition for an insurance file.',
      'Architectural still life only. No people. Daylight. Australian suburb.',
      `Subject: ${trimmed}`,
    ].join(' ');
  }

  private async generateWithImagen(prompt: string, model: string): Promise<GeneratedImage> {
    const url = this.modelUrl(model, 'predict', this.imagenLocation());
    const json = await this.postJson(url, {
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: '4:3',
        personGeneration: 'dont_allow',
      },
    });

    const predictions = Array.isArray(json.predictions) ? json.predictions : [];
    const first = predictions[0];
    const encoded =
      first && typeof first === 'object'
        ? (first as Record<string, unknown>).bytesBase64Encoded
        : undefined;
    if (typeof encoded !== 'string' || encoded === '') {
      throw new Error(`${LOG}.generateWithImagen: empty predictions from ${model}`);
    }
    const mimeType =
      first && typeof first === 'object' && typeof (first as Record<string, unknown>).mimeType === 'string'
        ? ((first as Record<string, unknown>).mimeType as string)
        : 'image/png';
    return { buffer: Buffer.from(encoded, 'base64'), mimeType };
  }

  private async generateWithGeminiImage(prompt: string): Promise<GeneratedImage> {
    const model = this.geminiImageModel();
    const location = this.geminiImageLocation();
    const url = this.modelUrl(model, 'generateContent', location);
    const json = await this.postJson(url, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio: '4:3' },
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
      ],
    });

    const candidate = (
      json.candidates as Array<{
        finishReason?: string;
        finish_reason?: string;
        content?: { parts?: Array<Record<string, unknown>> };
      }> | undefined
    )?.[0];
    const parts = candidate?.content?.parts ?? [];
    for (const part of parts) {
      const image = this.extractInlineImage(part);
      if (image) return image;
    }

    const finishReason = candidate?.finishReason ?? candidate?.finish_reason ?? 'unknown';
    const partKeys = parts.map((part) => Object.keys(part).join(','));
    const textPreview = parts
      .map((part) => (typeof part.text === 'string' ? part.text.slice(0, 120) : ''))
      .filter(Boolean)
      .join(' ')
      .slice(0, 200);
    const feedback = json.promptFeedback ?? json.prompt_feedback;
    this.logger.warn(
      `[${LOG}.generateWithGeminiImage] no image model=${model} location=${location} ` +
        `finishReason=${finishReason} partKeys=[${partKeys.join(';')}] ` +
        `text=${textPreview || '(none)'} keys=${Object.keys(json).join(',')} ` +
        `feedback=${feedback ? JSON.stringify(feedback).slice(0, 400) : '(none)'} ` +
        `body=${JSON.stringify(json).slice(0, 500)}`,
    );
    throw new Error(
      `${LOG}.generateWithGeminiImage: no image part from ${model} at ${location} ` +
        `finishReason=${finishReason}`,
    );
  }

  private extractInlineImage(part: Record<string, unknown>): GeneratedImage | null {
    const inlineRaw = part.inlineData ?? part.inline_data;
    if (!inlineRaw || typeof inlineRaw !== 'object') return null;
    const inline = inlineRaw as Record<string, unknown>;
    const data = inline.data;
    if (typeof data !== 'string' || data === '') return null;
    const mimeTypeRaw = inline.mimeType ?? inline.mime_type;
    const mimeType = typeof mimeTypeRaw === 'string' && mimeTypeRaw ? mimeTypeRaw : 'image/png';
    return { buffer: Buffer.from(data, 'base64'), mimeType };
  }

  private async postJson(url: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const token = await this.auth.getAccessToken();
    if (!token) {
      throw new Error(`${LOG}.postJson: failed to obtain GCP access token`);
    }

    let lastErr: Error | undefined;
    for (let attempt = 0; attempt < MAX_QUOTA_RETRIES; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        const text = await res.text();
        if (res.status === 429) {
          const delay = this.quotaDelayMs(attempt, res.headers.get('retry-after'));
          this.logger.warn(
            `[${LOG}.postJson] status=429 RESOURCE_EXHAUSTED attempt=${attempt + 1}/${MAX_QUOTA_RETRIES} retry in ${delay}ms`,
          );
          lastErr = new Error(`${LOG}.postJson: Vertex API 429`);
          await this.sleep(delay);
          continue;
        }
        if (!res.ok) {
          this.logger.error(`[${LOG}.postJson] status=${res.status} body=${text.slice(0, 500)}`);
          throw new Error(`${LOG}.postJson: Vertex API ${res.status}`);
        }
        return JSON.parse(text) as Record<string, unknown>;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastErr ?? new Error(`${LOG}.postJson: Vertex API 429`);
  }

  private modelUrl(model: string, method: 'predict' | 'generateContent', location: string): string {
    const project = this.projectId();
    const host =
      location === 'global' ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`;
    return (
      `https://${host}/v1/projects/${project}/locations/${location}` +
      `/publishers/google/models/${model}:${method}`
    );
  }

  private projectId(): string {
    const aiConfig = this.configService.get<{ vertexProject?: string }>('ai');
    return (aiConfig?.vertexProject || this.configService.get<string>('GCP_PROJECT_ID') || '').trim();
  }

  private geminiImageLocation(): string {
    const aiConfig = this.configService.get<{ vertexLocation?: string }>('ai');
    return aiConfig?.vertexLocation?.trim() || DEFAULT_GEMINI_LOCATION;
  }

  private imagenLocation(): string {
    const fromEnv = this.configService.get<string>('VERTEX_IMAGEN_LOCATION');
    if (fromEnv?.trim()) return fromEnv.trim();
    const aiConfig = this.configService.get<{ imagenLocation?: string }>('ai');
    if (aiConfig?.imagenLocation?.trim()) return aiConfig.imagenLocation.trim();
    return DEFAULT_IMAGEN_LOCATION;
  }

  /** Optional dedicated Imagen model. Empty by default — Imagen 3/4 IDs are discontinued. */
  private imagenModel(): string | undefined {
    const fromEnv = this.configService.get<string>('VERTEX_IMAGEN_MODEL')?.trim();
    if (fromEnv) return fromEnv;
    const aiConfig = this.configService.get<{ imagenModel?: string }>('ai');
    return aiConfig?.imagenModel?.trim() || undefined;
  }

  private geminiImageModel(): string {
    const fromEnv = this.configService.get<string>('VERTEX_IMAGE_FALLBACK_MODEL')?.trim();
    if (fromEnv) return fromEnv;
    const aiConfig = this.configService.get<{ imageFallbackModel?: string }>('ai');
    return aiConfig?.imageFallbackModel?.trim() || DEFAULT_GEMINI_IMAGE_MODEL;
  }

  private isQuotaError(err: unknown): boolean {
    const text = this.errorText(err);
    return /429|RESOURCE_EXHAUSTED|Resource exhausted/i.test(text);
  }

  private quotaDelayMs(attempt: number, retryAfterHeader?: string | null): number {
    const fromHeader = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : NaN;
    if (Number.isFinite(fromHeader) && fromHeader > 0) {
      return Math.min(fromHeader * 1000, QUOTA_BACKOFF_CAP_MS);
    }
    const exponential = Math.min(QUOTA_BACKOFF_BASE_MS * 2 ** attempt, QUOTA_BACKOFF_CAP_MS);
    const jitter = Math.floor(Math.random() * QUOTA_BACKOFF_JITTER_MS);
    return exponential + jitter;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private errorText(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
