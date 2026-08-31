import { GoogleGenAI } from '@google/genai';

const LOG = 'seeds/lib/guide-embedding';
const EMBEDDING_TIMEOUT_MS = 30_000;
const BATCH_SIZE = 20;

export interface GuidesIngestLogger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

export interface GuideEmbeddingClient {
  isConfigured(): boolean;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

export function createGuideEmbeddingClient(logger: GuidesIngestLogger): GuideEmbeddingClient {
  const project = process.env.VERTEX_AI_PROJECT || process.env.GCP_PROJECT_ID || '';
  const location = process.env.VERTEX_AI_LOCATION || process.env.VERTEX_LOCATION || 'global';
  const model = process.env.VERTEX_EMBEDDING_MODEL || 'text-embedding-005';

  if (!project) {
    logger.warn(
      `[${LOG}] Vertex AI not configured — guide chunks will be stored without embeddings`,
    );
    return {
      isConfigured: () => false,
      embed: async () => [],
      embedBatch: async (texts) => texts.map(() => []),
    };
  }

  const client = new GoogleGenAI({ vertexai: true, project, location });

  async function embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT_MS);

      try {
        const response = await client.models.embedContent({
          model,
          contents: batch.map((t) => ({ parts: [{ text: t }] })),
          config: { outputDimensionality: 768 },
        });
        const embeddings = (response.embeddings ?? []).map((e) => e.values ?? []);
        results.push(...embeddings);
      } catch (err) {
        logger.warn(
          `[${LOG}] embed batch failed (${i}-${i + batch.length}): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        results.push(...batch.map(() => []));
      } finally {
        clearTimeout(timeoutId);
      }
    }

    return results;
  }

  return {
    isConfigured: () => true,
    embed: async (text) => {
      const [vec] = await embedBatch([text]);
      return vec ?? [];
    },
    embedBatch,
  };
}
