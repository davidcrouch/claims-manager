import { Logger } from '@nestjs/common';
import type { CompletionProvider } from './types';
import { VertexGeminiProvider } from './vertex-gemini.provider';
import { VertexAnthropicProvider } from './vertex-anthropic.provider';

const logger = new Logger('ModelRouter');

export type ChatProviderId = 'vertex-gemini' | 'vertex-anthropic' | 'google' | 'anthropic';

export interface SupportedModelOption {
  id: string;
  label: string;
}

const SUPPORTED_MODEL_OPTIONS: Record<'google' | 'anthropic', SupportedModelOption[]> = {
  google: [
    { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
    { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  ],
  anthropic: [
    { id: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
    { id: 'claude-haiku-4-5@20251001', label: 'Claude Haiku 4.5' },
  ],
};

function normalizeProvider(provider: ChatProviderId): 'google' | 'anthropic' {
  switch (provider) {
    case 'vertex-gemini':
    case 'google':
      return 'google';
    case 'vertex-anthropic':
    case 'anthropic':
      return 'anthropic';
    default:
      throw new Error(`[ModelRouter.normalizeProvider] unsupported provider "${provider}"`);
  }
}

export function createProvider(
  provider: ChatProviderId,
  model: string,
  project: string,
  location: string,
): CompletionProvider {
  const normalized = normalizeProvider(provider);
  switch (normalized) {
    case 'google':
      return new VertexGeminiProvider(model, project, location);
    case 'anthropic':
      return new VertexAnthropicProvider(model, project, location);
    default:
      throw new Error(
        `[ModelRouter.createProvider] unsupported provider "${provider}"`,
      );
  }
}

export function getSupportedModelOptions(): Record<'google' | 'anthropic', SupportedModelOption[]> {
  return SUPPORTED_MODEL_OPTIONS;
}

export function getSupportedModels(): Record<'google' | 'anthropic', string[]> {
  return {
    google: SUPPORTED_MODEL_OPTIONS.google.map((m) => m.id),
    anthropic: SUPPORTED_MODEL_OPTIONS.anthropic.map((m) => m.id),
  };
}

export function resolveModelLocation(
  _provider: ChatProviderId,
  model: string,
  locations: { primary: string; extended: string },
): string {
  const location = locations.primary || 'global';
  logger.log(`[ModelRouter.resolveModelLocation] ${model} routed to ${location}`);
  return location;
}

// ── Query Routing Heuristics ──

interface ModelRouteResult {
  provider: string;
  model: string;
  reason: string;
}

interface RoutingRule {
  pattern: RegExp;
  provider: string;
  model: string;
  reason: string;
}

const ROUTING_RULES: RoutingRule[] = [
  {
    pattern: /\b(compare|analysis|analyz|evaluat|assess|review|deep|research|comprehensive)\b/i,
    provider: 'google',
    model: 'gemini-2.5-pro',
    reason: 'Complex reasoning task',
  },
  {
    pattern: /\b(code|function|implement|debug|refactor|typescript|javascript|python|sql)\b/i,
    provider: 'google',
    model: 'gemini-3.5-flash',
    reason: 'Code-related task',
  },
  {
    pattern: /\b(draft|write|email|letter|communication|message)\b/i,
    provider: 'google',
    model: 'gemini-3.5-flash',
    reason: 'Content generation',
  },
  {
    pattern: /\b(summary|summarise|summarize|brief|quick|status|list|show)\b/i,
    provider: 'google',
    model: 'gemini-2.5-flash',
    reason: 'Simple lookup/summary',
  },
];

const DEFAULT_ROUTE: ModelRouteResult = {
  provider: 'google',
  model: 'gemini-2.5-flash',
  reason: 'Default routing',
};

export function routeQuery(query: string): ModelRouteResult {
  for (const rule of ROUTING_RULES) {
    if (rule.pattern.test(query)) {
      return { provider: rule.provider, model: rule.model, reason: rule.reason };
    }
  }
  return DEFAULT_ROUTE;
}

const MODEL_TIER: Record<string, number> = {
  'gemini-2.0-flash': 1,
  'gemini-2.5-flash': 2,
  'gemini-3.5-flash': 3,
  'gemini-2.5-pro': 4,
  'gemini-3.1-pro-preview': 5,
};

export function shouldUpgradeModel(
  currentModel: string,
  query: string,
  conversationLength: number,
): ModelRouteResult | null {
  const suggested = routeQuery(query);

  if (conversationLength > 20 && currentModel.includes('flash')) {
    return {
      provider: 'google',
      model: 'gemini-2.5-pro',
      reason: 'Long conversation benefits from larger context model',
    };
  }

  const currentTier = MODEL_TIER[currentModel] ?? 1;
  const suggestedTier = MODEL_TIER[suggested.model] ?? 1;

  if (suggestedTier > currentTier) {
    return suggested;
  }

  return null;
}
