import { GoogleAuth } from 'google-auth-library';
import { Logger } from '@nestjs/common';
import type {
  CompletionProvider,
  GenerateResult,
  ProviderMessage,
  ProviderToolDefinition,
} from './types';

const LOG = '[VertexGeminiProvider]';

/**
 * Thin Vertex Gemini REST client using Application Default Credentials
 * (same ADC path as GCS / data_cloud — no service-account JSON in local/dev).
 */
export class VertexGeminiProvider implements CompletionProvider {
  private readonly logger = new Logger(VertexGeminiProvider.name);
  private readonly auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });

  constructor(
    private readonly projectId: string,
    private readonly location: string = 'global',
  ) {}

  async generate(params: {
    model: string;
    instructions?: string;
    messages: ProviderMessage[];
    tools?: ProviderToolDefinition[];
    temperature?: number;
    maxOutputTokens?: number;
  }): Promise<GenerateResult> {
    const token = await this.auth.getAccessToken();
    if (!token) {
      throw new Error(`${LOG}.generate: failed to obtain GCP access token`);
    }

    const host =
      this.location === 'global'
        ? 'aiplatform.googleapis.com'
        : `${this.location}-aiplatform.googleapis.com`;
    const url =
      `https://${host}/v1/projects/` +
      `${this.projectId}/locations/${this.location}/publishers/google/models/` +
      `${params.model}:generateContent`;

    type VertexPart =
      | { text: string }
      | { functionCall: { name: string; args: Record<string, unknown> } }
      | { functionResponse: { name: string; response: Record<string, unknown> } };

    const contents = params.messages
      .filter((m) => m.role !== 'system')
      .map((m) => {
        const parts: VertexPart[] = [];
        for (const c of m.content) {
          if (c.type === 'text') {
            parts.push({ text: c.text });
          } else if (c.type === 'tool-call') {
            parts.push({
              functionCall: { name: c.name, args: c.args },
            });
          } else if (c.type === 'tool-result') {
            parts.push({
              functionResponse: {
                name: c.name,
                response:
                  typeof c.result === 'object' && c.result !== null
                    ? (c.result as Record<string, unknown>)
                    : { result: c.result },
              },
            });
          }
        }
        return {
          role: m.role === 'assistant' ? 'model' : 'user',
          parts,
        };
      });

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: params.temperature ?? 0.2,
        maxOutputTokens: params.maxOutputTokens ?? 2048,
      },
    };

    if (params.instructions) {
      body.systemInstruction = { parts: [{ text: params.instructions }] };
    }

    if (params.tools?.length) {
      body.tools = [
        {
          functionDeclarations: params.tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.inputSchema,
          })),
        },
      ];
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      this.logger.error(`${LOG}.generate status=${res.status} body=${errText.slice(0, 500)}`);
      throw new Error(`${LOG}.generate: Vertex API ${res.status}`);
    }

    const json = (await res.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
            functionCall?: { name?: string; args?: Record<string, unknown> };
          }>;
        };
      }>;
    };

    const parts = json.candidates?.[0]?.content?.parts ?? [];
    let text = '';
    const toolCalls: GenerateResult['toolCalls'] = [];

    for (const part of parts) {
      if (part.text) text += part.text;
      if (part.functionCall?.name) {
        toolCalls.push({
          id: `call_${toolCalls.length}_${Date.now()}`,
          name: part.functionCall.name,
          args: part.functionCall.args ?? {},
        });
      }
    }

    return { text, toolCalls };
  }
}
