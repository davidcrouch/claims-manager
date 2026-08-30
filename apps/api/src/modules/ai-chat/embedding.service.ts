import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

const LOG_PREFIX = 'EmbeddingService';
const EMBEDDING_TIMEOUT_MS = 5_000;

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly client: GoogleGenAI | null;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    const aiConfig = this.configService.get('ai', { infer: true });
    this.model = aiConfig?.embeddingModel ?? 'text-embedding-005';
    const project = aiConfig?.vertexProject ?? '';
    const location = aiConfig?.vertexLocation ?? 'global';

    if (!project) {
      this.logger.warn(
        `[${LOG_PREFIX}.constructor] Vertex AI project not configured (set VERTEX_AI_PROJECT or GCP_PROJECT_ID) — embeddings disabled`,
      );
      this.client = null;
      return;
    }

    this.client = new GoogleGenAI({
      vertexai: true,
      project,
      location,
    });
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async embed(text: string): Promise<number[]> {
    const results = await this.embedBatch([text]);
    return results[0] ?? [];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    if (!this.client) {
      this.logger.warn(
        `[${LOG_PREFIX}.embedBatch] skipped — Vertex AI not configured textCount=${texts.length}`,
      );
      return texts.map(() => []);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT_MS);

    try {
      const response = await this.client.models.embedContent({
        model: this.model,
        contents: texts.map((t) => ({ parts: [{ text: t }] })),
        config: {
          outputDimensionality: 768,
        },
      });

      if (!response.embeddings || response.embeddings.length === 0) {
        throw new Error('No embeddings returned from Vertex AI');
      }

      return response.embeddings.map((e) => e.values ?? []);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        this.logger.warn(
          `[${LOG_PREFIX}.embedBatch] embedding request timed out timeoutMs=${EMBEDDING_TIMEOUT_MS} textCount=${texts.length}`,
        );
        return texts.map(() => []);
      }
      this.logger.error(
        `[${LOG_PREFIX}.embedBatch] embedding request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
