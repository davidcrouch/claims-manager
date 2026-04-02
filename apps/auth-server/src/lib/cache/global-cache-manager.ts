import { Redis as UpstashRedis } from '@upstash/redis';
import Redis from 'ioredis';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { createLogger, LoggerType } from '../logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';

export type RedisProvider = 'upstash' | 'self-hosted';

export interface UpstashConfig {
  provider: 'upstash';
  url: string;
  token: string;
}

export interface SelfHostedConfig {
  provider: 'self-hosted';
  host: string;
  port: number;
  password?: string;
  db?: number;
  tls?: boolean;
  maxRetries?: number;
  retryDelayOnFailover?: number;
  connectTimeout?: number;
  commandTimeout?: number;
}

interface LegacyUpstashConfig {
  url: string;
  token: string;
}

export type UnifiedCacheConfig = UpstashConfig | SelfHostedConfig;

export interface SetOptions {
  ex?: number;
  px?: number;
  nx?: boolean;
  xx?: boolean;
}

export interface ScanOptions {
  match?: string;
  count?: number;
}

export interface IUnifiedRedisClient {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, options?: SetOptions): Promise<string | null>;
  del(...keys: string[]): Promise<number>;
  exists(...keys: string[]): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
  hget<T = unknown>(key: string, field: string): Promise<T | null>;
  hset(key: string, field: string, value: unknown): Promise<number>;
  hgetall<T = Record<string, unknown>>(key: string): Promise<T | null>;
  hdel(key: string, ...fields: string[]): Promise<number>;
  lpush(key: string, ...values: unknown[]): Promise<number>;
  rpush(key: string, ...values: unknown[]): Promise<number>;
  lpop<T = unknown>(key: string): Promise<T | null>;
  rpop<T = unknown>(key: string): Promise<T | null>;
  lrange<T = unknown>(key: string, start: number, stop: number): Promise<T[]>;
  sadd(key: string, ...members: unknown[]): Promise<number>;
  srem(key: string, ...members: unknown[]): Promise<number>;
  smembers<T = unknown>(key: string): Promise<T[]>;
  sismember(key: string, member: unknown): Promise<number>;
  ping(): Promise<string>;
  keys(pattern: string): Promise<string[]>;
  scan(cursor: number, options?: ScanOptions): Promise<[string, string[]]>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

const baseLogger = createLogger('auth-server:global-cache-manager', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'global-cache-manager', 'GlobalCacheManager', 'auth-server');

const redisLog = createLogger('auth-server:redis-client', LoggerType.NODEJS);

class UpstashRedisClient implements IUnifiedRedisClient {
  private client: UpstashRedis;
  private connected = false;

  constructor(config: UpstashConfig) {
    this.client = new UpstashRedis({
      url: config.url,
      token: config.token,
    });
    this.connected = true;
    redisLog.info({}, 'auth-server:redis-client:constructor - Upstash Redis client initialized');
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    return this.client.get<T>(key);
  }

  async set(key: string, value: unknown, options?: SetOptions): Promise<string | null> {
    const opts: Record<string, unknown> = {};
    if (options?.ex) opts.ex = options.ex;
    if (options?.px) opts.px = options.px;
    if (options?.nx) opts.nx = true;
    if (options?.xx) opts.xx = true;
    const result = await this.client.set(key, value, opts);
    return result as string | null;
  }

  async del(...keys: string[]): Promise<number> {
    return this.client.del(...keys);
  }

  async exists(...keys: string[]): Promise<number> {
    return this.client.exists(...keys);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.client.expire(key, seconds);
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async hget<T = unknown>(key: string, field: string): Promise<T | null> {
    return this.client.hget<T>(key, field);
  }

  async hset(key: string, field: string, value: unknown): Promise<number> {
    return this.client.hset(key, { [field]: value });
  }

  async hgetall<T = Record<string, unknown>>(key: string): Promise<T | null> {
    const result = await this.client.hgetall<Record<string, unknown>>(key);
    return result as T | null;
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    return this.client.hdel(key, ...fields);
  }

  async lpush(key: string, ...values: unknown[]): Promise<number> {
    return this.client.lpush(key, ...values);
  }

  async rpush(key: string, ...values: unknown[]): Promise<number> {
    return this.client.rpush(key, ...values);
  }

  async lpop<T = unknown>(key: string): Promise<T | null> {
    return this.client.lpop<T>(key);
  }

  async rpop<T = unknown>(key: string): Promise<T | null> {
    return this.client.rpop<T>(key);
  }

  async lrange<T = unknown>(key: string, start: number, stop: number): Promise<T[]> {
    return this.client.lrange<T>(key, start, stop);
  }

  async sadd(key: string, ...members: unknown[]): Promise<number> {
    const normalized = members.map((member) => (typeof member === 'string' ? member : JSON.stringify(member)));
    return (this.client as unknown as { sadd: (...args: string[]) => Promise<number> }).sadd(key, ...normalized);
  }

  async srem(key: string, ...members: unknown[]): Promise<number> {
    return this.client.srem(key, ...members);
  }

  async smembers<T = unknown>(key: string): Promise<T[]> {
    const result = await this.client.smembers(key);
    return result as unknown as T[];
  }

  async sismember(key: string, member: unknown): Promise<number> {
    const result = await this.client.sismember(key, member as string);
    return result ? 1 : 0;
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  async scan(cursor: number, options?: ScanOptions): Promise<[string, string[]]> {
    const result = await this.client.scan(cursor, {
      match: options?.match,
      count: options?.count,
    });
    return [result[0].toString(), result[1]];
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    redisLog.info({}, 'auth-server:redis-client:disconnect - Upstash Redis client disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }
}

class SelfHostedRedisClient implements IUnifiedRedisClient {
  private client: Redis;
  private connected = false;

  constructor(config: SelfHostedConfig) {
    this.client = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db ?? 0,
      tls: config.tls ? {} : undefined,
      maxRetriesPerRequest: config.maxRetries ?? 3,
      connectTimeout: config.connectTimeout ?? 10000,
      commandTimeout: config.commandTimeout ?? 5000,
      retryStrategy: (times: number) => {
        if (times > (config.maxRetries ?? 3)) {
          redisLog.error({ times }, 'auth-server:redis-client:retryStrategy - Max retries reached');
          return null;
        }
        const delay = Math.min(times * (config.retryDelayOnFailover ?? 100), 3000);
        redisLog.warn({ times, delay }, 'auth-server:redis-client:retryStrategy - Retrying connection');
        return delay;
      },
      lazyConnect: false,
    });

    this.client.on('connect', () => {
      this.connected = true;
      redisLog.info({}, 'auth-server:redis-client:connect - Self-hosted Redis connected');
    });

    this.client.on('error', (err) => {
      redisLog.error({ error: err.message }, 'auth-server:redis-client:error - Self-hosted Redis error');
    });

    this.client.on('close', () => {
      this.connected = false;
      redisLog.info({}, 'auth-server:redis-client:close - Self-hosted Redis connection closed');
    });
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const result = await this.client.get(key);
    if (result === null) return null;
    try {
      return JSON.parse(result) as T;
    } catch {
      return result as unknown as T;
    }
  }

  async set(key: string, value: unknown, options?: SetOptions): Promise<string | null> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);

    if (options?.ex) {
      if (options?.nx) return this.client.set(key, serialized, 'EX', options.ex, 'NX');
      if (options?.xx) return this.client.set(key, serialized, 'EX', options.ex, 'XX');
      return this.client.set(key, serialized, 'EX', options.ex);
    }
    if (options?.px) {
      if (options?.nx) return this.client.set(key, serialized, 'PX', options.px, 'NX');
      if (options?.xx) return this.client.set(key, serialized, 'PX', options.px, 'XX');
      return this.client.set(key, serialized, 'PX', options.px);
    }
    if (options?.nx) return this.client.set(key, serialized, 'NX');
    if (options?.xx) return this.client.set(key, serialized, 'XX');
    return this.client.set(key, serialized);
  }

  async del(...keys: string[]): Promise<number> {
    return this.client.del(...keys);
  }

  async exists(...keys: string[]): Promise<number> {
    return this.client.exists(...keys);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.client.expire(key, seconds);
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async hget<T = unknown>(key: string, field: string): Promise<T | null> {
    const result = await this.client.hget(key, field);
    if (result === null) return null;
    try {
      return JSON.parse(result) as T;
    } catch {
      return result as unknown as T;
    }
  }

  async hset(key: string, field: string, value: unknown): Promise<number> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    return this.client.hset(key, field, serialized);
  }

  async hgetall<T = Record<string, unknown>>(key: string): Promise<T | null> {
    const result = await this.client.hgetall(key);
    if (!result || Object.keys(result).length === 0) return null;
    const parsed: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(result)) {
      try {
        parsed[k] = JSON.parse(v);
      } catch {
        parsed[k] = v;
      }
    }
    return parsed as T;
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    return this.client.hdel(key, ...fields);
  }

  async lpush(key: string, ...values: unknown[]): Promise<number> {
    const serialized = values.map((v) => (typeof v === 'string' ? v : JSON.stringify(v)));
    return this.client.lpush(key, ...serialized);
  }

  async rpush(key: string, ...values: unknown[]): Promise<number> {
    const serialized = values.map((v) => (typeof v === 'string' ? v : JSON.stringify(v)));
    return this.client.rpush(key, ...serialized);
  }

  async lpop<T = unknown>(key: string): Promise<T | null> {
    const result = await this.client.lpop(key);
    if (result === null) return null;
    try {
      return JSON.parse(result) as T;
    } catch {
      return result as unknown as T;
    }
  }

  async rpop<T = unknown>(key: string): Promise<T | null> {
    const result = await this.client.rpop(key);
    if (result === null) return null;
    try {
      return JSON.parse(result) as T;
    } catch {
      return result as unknown as T;
    }
  }

  async lrange<T = unknown>(key: string, start: number, stop: number): Promise<T[]> {
    const results = await this.client.lrange(key, start, stop);
    return results.map((r) => {
      try {
        return JSON.parse(r) as T;
      } catch {
        return r as unknown as T;
      }
    });
  }

  async sadd(key: string, ...members: unknown[]): Promise<number> {
    const serialized = members.map((m) => (typeof m === 'string' ? m : JSON.stringify(m)));
    return this.client.sadd(key, ...serialized);
  }

  async srem(key: string, ...members: unknown[]): Promise<number> {
    const serialized = members.map((m) => (typeof m === 'string' ? m : JSON.stringify(m)));
    return this.client.srem(key, ...serialized);
  }

  async smembers<T = unknown>(key: string): Promise<T[]> {
    const results = await this.client.smembers(key);
    return results.map((r) => {
      try {
        return JSON.parse(r) as T;
      } catch {
        return r as unknown as T;
      }
    });
  }

  async sismember(key: string, member: unknown): Promise<number> {
    const serialized = typeof member === 'string' ? member : JSON.stringify(member);
    return this.client.sismember(key, serialized);
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  async scan(cursor: number, options?: ScanOptions): Promise<[string, string[]]> {
    const args: (string | number)[] = [cursor];
    if (options?.match) {
      args.push('MATCH', options.match);
    }
    if (options?.count) {
      args.push('COUNT', options.count);
    }
    const result = await (this.client as unknown as { scan: (...scanArgs: (string | number)[]) => Promise<[string, string[]]> }).scan(...args);
    return [result[0], result[1]];
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
    this.connected = false;
    redisLog.info({}, 'auth-server:redis-client:disconnect - Self-hosted Redis client disconnected');
  }

  isConnected(): boolean {
    return this.connected && this.client.status === 'ready';
  }
}

function createUnifiedRedisClient(config: UnifiedCacheConfig): IUnifiedRedisClient {
  return config.provider === 'upstash'
    ? new UpstashRedisClient(config)
    : new SelfHostedRedisClient(config);
}

function createRedisClientFromEnv(): IUnifiedRedisClient {
  const provider = process.env.REDIS_PROVIDER as RedisProvider | undefined;
  if (provider === 'upstash') {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      throw new Error('auth-server:global-cache-manager:createRedisClientFromEnv - Upstash URL/token required');
    }
    return createUnifiedRedisClient({ provider: 'upstash', url, token });
  }

  if (provider === 'self-hosted') {
    return createUnifiedRedisClient({
      provider: 'self-hosted',
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB ?? '0', 10),
      tls: process.env.REDIS_TLS === 'true',
    });
  }

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (upstashUrl && upstashToken) {
    return createUnifiedRedisClient({ provider: 'upstash', url: upstashUrl, token: upstashToken });
  }

  return createUnifiedRedisClient({
    provider: 'self-hosted',
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB ?? '0', 10),
    tls: process.env.REDIS_TLS === 'true',
  });
}

function normalizeConfig(config: UnifiedCacheConfig | LegacyUpstashConfig): UnifiedCacheConfig {
  if ('provider' in config) return config;
  return { provider: 'upstash', url: config.url, token: config.token };
}

export class GlobalCacheManager {
  private static instance: IUnifiedRedisClient | null = null;
  private static componentInstances: Map<string, IUnifiedRedisClient> = new Map();
  private static isInitialized = false;
  private static initializationPromise: Promise<IUnifiedRedisClient> | null = null;
  private static config: UnifiedCacheConfig | null = null;

  static async initialize(config: UnifiedCacheConfig | LegacyUpstashConfig): Promise<void> {
    if (this.isInitialized && this.instance) {
      return;
    }
    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }
    const normalized = normalizeConfig(config);
    this.initializationPromise = this.initializeConnection(normalized);
    await this.initializationPromise;
  }

  static async initializeFromEnv(): Promise<void> {
    if (this.isInitialized && this.instance) {
      return;
    }
    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }
    this.initializationPromise = this.initializeConnectionFromEnv();
    await this.initializationPromise;
  }

  static async getInstance(component: string): Promise<IUnifiedRedisClient> {
    if (!this.isInitialized || !this.instance) {
      throw new Error('auth-server:global-cache-manager:getInstance - Manager not initialized');
    }
    if (this.componentInstances.has(component)) {
      return this.componentInstances.get(component)!;
    }
    this.componentInstances.set(component, this.instance);
    return this.instance;
  }

  static async reset(): Promise<void> {
    if (this.instance) {
      await this.instance.disconnect();
    }
    this.instance = null;
    this.componentInstances.clear();
    this.isInitialized = false;
    this.initializationPromise = null;
    this.config = null;
  }

  static isReady(): boolean {
    return this.isInitialized && this.instance !== null;
  }

  static getProvider(): RedisProvider | 'unknown' {
    return this.config?.provider ?? 'unknown';
  }

  private static async initializeConnection(config: UnifiedCacheConfig): Promise<IUnifiedRedisClient> {
    const tracer = trace.getTracer('auth-server:global-cache-manager', '1.0.0');
    return tracer.startActiveSpan('initializeConnection', async (span) => {
      try {
        this.config = config;
        this.instance = createUnifiedRedisClient(config);
        await this.testConnection();
        this.isInitialized = true;
        log.info({ provider: config.provider }, 'auth-server:global-cache-manager:initializeConnection - Initialized');
        span.setStatus({ code: SpanStatusCode.OK });
        return this.instance;
      } catch (error) {
        this.instance = null;
        this.isInitialized = false;
        this.initializationPromise = null;
        this.config = null;
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  private static async initializeConnectionFromEnv(): Promise<IUnifiedRedisClient> {
    this.instance = createRedisClientFromEnv();
    const provider = process.env.REDIS_PROVIDER as RedisProvider | undefined;
    if (provider === 'upstash' || (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)) {
      this.config = {
        provider: 'upstash',
        url: process.env.UPSTASH_REDIS_REST_URL ?? '',
        token: process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
      };
    } else {
      this.config = {
        provider: 'self-hosted',
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB ?? '0', 10),
        tls: process.env.REDIS_TLS === 'true',
      };
    }
    await this.testConnection();
    this.isInitialized = true;
    return this.instance;
  }

  private static async testConnection(): Promise<void> {
    if (!this.instance) {
      throw new Error('auth-server:global-cache-manager:testConnection - Cache instance missing');
    }
    await this.instance.ping();
    const key = 'auth-server:cache:connection-test';
    const value = { timestamp: Date.now(), test: true };
    await this.instance.set(key, value, { ex: 10 });
    const retrieved = await this.instance.get<typeof value>(key);
    await this.instance.del(key);
    if (!retrieved || retrieved.timestamp !== value.timestamp) {
      throw new Error('auth-server:global-cache-manager:testConnection - Read/write verification failed');
    }
  }
}

