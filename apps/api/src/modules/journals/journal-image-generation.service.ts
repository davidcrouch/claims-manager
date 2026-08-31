import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuth } from 'google-auth-library';

const LOG = 'JournalImageGenerationService';
const DEFAULT_IMAGEN_MODEL = 'imagen-3.0-generate-002';
const DEFAULT_FALLBACK_MODEL = 'gemini-2.5-flash-image';
const DEFAULT_LOCATION = 'us-central1';
const REQUEST_TIMEOUT_MS = 90_000;

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

    const wrapped = this.wrapPrompt(prompt);
    try {
      return await this.generateWithImagen(wrapped);
    } catch (err) {
      this.logger.warn(
        `[${LOG}.generateInspectionPhoto] Imagen failed — ${this.errorText(err)}. Trying Gemini image fallback.`,
      );
      return await this.generateWithGeminiImage(wrapped);
    }
  }

  private wrapPrompt(prompt: string): string {
    const trimmed = prompt.trim();
    return [
      'Photorealistic handheld site-inspection photograph for an Australian residential insurance claim.',
      'Natural daylight, phone-camera quality, slight grain, no people, no faces, no text overlays, no watermarks, no logos.',
      'The photo should look like evidence taken by a claims inspector walking a property.',
      `Subject: ${trimmed}`,
    ].join(' ');
  }

  private async generateWithImagen(prompt: string): Promise<GeneratedImage> {
    const model = this.imagenModel();
    const url = this.modelUrl(model, 'predict');
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
    if (typeof encoded !== 'string' || !encoded) {
      throw new Error(`${LOG}.generateWithImagen: empty predictions from ${model}`);
    }
    const mimeType =
      first && typeof first === 'object' && typeof (first as Record<string, unknown>).mimeType === 'string'
        ? ((first as Record<string, unknown>).mimeType as string)
        : 'image/png';
    return { buffer: Buffer.from(encoded, 'base64'), mimeType };
  }

  private async generateWithGeminiImage(prompt: string): Promise<GeneratedImage> {
    const model = this.fallbackModel();
    const url = this.modelUrl(model, 'generateContent');
    const json = await this.postJson(url, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
    });

    const parts =
      (json.candidates as Array<{ content?: { parts?: Array<Record<string, unknown>> } }> | undefined)?.[0]
        ?.content?.parts ?? [];
    for (const part of parts) {
      const inline = part.inlineData;
      if (inline && typeof inline === 'object') {
        const data = (inline as Record<string, unknown>).data;
        if (typeof data === 'string' && data) {
          const mimeType =
            typeof (inline as Record<string, unknown>).mimeType === 'string'
              ? ((inline as Record<string, unknown>).mimeType as string)
              : 'image/png';
          return { buffer: Buffer.from(data, 'base64'), mimeType };
        }
      }
    }
    throw new Error(`${LOG}.generateWithGeminiImage: no image part from ${model}`);
  }

  private async postJson(url: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const token = await this.auth.getAccessToken();
    if (!token) {
      throw new Error(`${LOG}.postJson: failed to obtain GCP access token`);
    }

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
      if (!res.ok) {
        this.logger.error(`[${LOG}.postJson] status=${res.status} body=${text.slice(0, 500)}`);
        throw new Error(`${LOG}.postJson: Vertex API ${res.status}`);
      }
      return JSON.parse(text) as Record<string, unknown>;
    } finally {
      clearTimeout(timer);
    }
  }

  private modelUrl(model: string, method: 'predict' | 'generateContent'): string {
    const project = this.projectId();
    const location = this.location();
    const host = `${location}-aiplatform.googleapis.com`;
    return (
      `https://${host}/v1/projects/${project}/locations/${location}` +
      `/publishers/google/models/${model}:${method}`
    );
  }

  private projectId(): string {
    const aiConfig = this.configService.get('ai', { infer: true }) as
      | { vertexProject?: string }
      | undefined;
    return (aiConfig?.vertexProject || this.configService.get<string>('GCP_PROJECT_ID') || '').trim();
  }

  private location(): string {
    const fromEnv = this.configService.get<string>('VERTEX_IMAGEN_LOCATION');
    if (fromEnv?.trim()) return fromEnv.trim();
    const aiConfig = this.configService.get('ai', { infer: true }) as
      | { imagenLocation?: string }
      | undefined;
    if (aiConfig?.imagenLocation?.trim()) return aiConfig.imagenLocation.trim();
    return DEFAULT_LOCATION;
  }

  private imagenModel(): string {
    const fromEnv = this.configService.get<string>('VERTEX_IMAGEN_MODEL')?.trim();
    if (fromEnv) return fromEnv;
    const aiConfig = this.configService.get('ai', { infer: true }) as
      | { imagenModel?: string }
      | undefined;
    return aiConfig?.imagenModel?.trim() || DEFAULT_IMAGEN_MODEL;
  }

  private fallbackModel(): string {
    const fromEnv = this.configService.get<string>('VERTEX_IMAGE_FALLBACK_MODEL')?.trim();
    if (fromEnv) return fromEnv;
    const aiConfig = this.configService.get('ai', { infer: true }) as
      | { imageFallbackModel?: string }
      | undefined;
    return aiConfig?.imageFallbackModel?.trim() || DEFAULT_FALLBACK_MODEL;
  }

  private errorText(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
