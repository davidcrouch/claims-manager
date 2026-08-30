import { registerAs } from '@nestjs/config';

export default registerAs('ai', () => ({
  vertexProject: process.env.VERTEX_AI_PROJECT || process.env.GCP_PROJECT_ID || '',
  vertexLocation: process.env.VERTEX_AI_LOCATION || process.env.VERTEX_LOCATION || 'global',
  embeddingModel: process.env.VERTEX_EMBEDDING_MODEL || 'text-embedding-005',
  defaultModel: process.env.DEFAULT_CHAT_MODEL || process.env.VERTEX_GEMINI_MODEL || 'gemini-2.5-flash',
  defaultProvider: process.env.DEFAULT_CHAT_PROVIDER || 'vertex-gemini',
  mcpOauthCallbackBaseUrl: process.env.MCP_OAUTH_CALLBACK_BASE_URL || 'http://localhost:5002',
  claimsMcpUrl: process.env.CLAIMS_MCP_URL || 'http://localhost:4601',
}));
