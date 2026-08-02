import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request, Response, NextFunction } from 'express';

interface RequestContext {
  accessToken: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function requireAccessToken(): string {
  const ctx = requestContext.getStore();
  if (!ctx?.accessToken) {
    throw new Error('[tokenExtract.requireAccessToken] no access token in request context');
  }
  return ctx.accessToken;
}

export function getTokenFromRequest(req: Request): string | undefined {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return undefined;
  return auth.slice(7);
}

export function createTokenMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/healthz' || (req.path === '/' && req.method === 'GET')) {
      return next();
    }
    const token = getTokenFromRequest(req);
    if (!token) {
      res.status(401).json({ error: 'unauthorized', message: 'Bearer token required' });
      return;
    }
    (req as any).__ms_graph_token = token;
    next();
  };
}
