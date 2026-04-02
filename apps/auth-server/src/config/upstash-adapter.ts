import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { GlobalCacheManager, type IUnifiedRedisClient } from '../lib/cache/global-cache-manager.js';
import { getTokenTtlConfig } from './env-validation.js';

let redis: IUnifiedRedisClient;

const baseLogger = createLogger('auth-server:upstash-adapter', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'upstash-adapter', 'UpstashAdapter', 'auth-server');

type Stored = Record<string, any>;
const key = (m: string, id: string) => `oidc:${m}:${id}`;
const grantKey = (g: string) => `oidc:grant:${g}`;
const uidKey = (u: string) => `oidc:uid:${u}`;
const userCodeKey = (c: string) => `oidc:userCode:${c}`;
// Get TTL configuration from centralized env-validation
const getDefaultTtl = (modelName: string): number | undefined => {
   const ttlConfig = getTokenTtlConfig();
   
   switch (modelName) {
      case 'Session':
         return ttlConfig.session;
      case 'Interaction':
         return ttlConfig.interaction;
      case 'Grant':
         return ttlConfig.refreshToken;
      default:
         return undefined;
   }
};

class RedisAdapter {
   constructor(private name: string) { 
      log.info({ model: this.name }, 'RedisAdapter: Created for model');
   }

   async upsert(id: string, payload: Stored, expiresIn?: number) {
      const tracer = trace.getTracer('upstash-adapter', '1.0.0');
      
      return tracer.startActiveSpan('upsert', {
         attributes: {
            'redis.operation': 'upsert',
            'redis.model': this.name,
            'redis.id': id,
            'redis.has_payload': !!payload,
            'redis.payload_keys': Object.keys(payload || {}).length,
            'redis.has_expires_in': !!expiresIn
         }
      }, async (span) => {
         try {
            const k = key(this.name, id);
            log.debug({
               functionName: 'upsert',
               id,
               payloadKeys: Object.keys(payload || {}),
               expiresIn
            }, `RedisAdapter.upsert: Storing ${this.name} with key: ${k}`);
         
            let ttl = expiresIn ?? (typeof payload?.exp === 'number' ? Math.max(1, payload.exp - Math.floor(Date.now() / 1000)) : undefined);
            if (!ttl) ttl = getDefaultTtl(this.name);

            if (ttl) {
                log.debug({ ttl }, 'RedisAdapter.upsert: Setting with TTL');
               await redis.set(k, payload, { ex: ttl });
            } else {
               log.debug({}, 'RedisAdapter.upsert: Setting without TTL');
               await redis.set(k, payload);
            }

            if (payload?.grantId) {
               log.debug({ grantKey: grantKey(payload.grantId) }, 'RedisAdapter.upsert: Adding to grant set');
               await redis.sadd(grantKey(payload.grantId), id);
               if (ttl) await redis.expire(grantKey(payload.grantId), ttl);
            }
            if (payload?.userCode) {
               log.debug({ userCodeKey: userCodeKey(payload.userCode) }, 'RedisAdapter.upsert: Setting user code');
               await redis.set(userCodeKey(payload.userCode), id, { ex: ttl ?? 3600 });
            }
            if (payload?.uid) {
               log.debug({ uidKey: uidKey(payload.uid) }, 'RedisAdapter.upsert: Setting UID');
               await redis.set(uidKey(payload.uid), id, { ex: ttl ?? 3600 });
            }
            
            log.info({ model: this.name, id }, 'RedisAdapter.upsert: Successfully stored');
            
            span.setAttributes({
               'redis.upsert_success': true,
               'redis.key': k,
               'redis.ttl': ttl || 0,
               'redis.has_grant_id': !!payload?.grantId,
               'redis.has_user_code': !!payload?.userCode,
               'redis.has_uid': !!payload?.uid
            });
            span.setStatus({ code: SpanStatusCode.OK });
         } catch (error) {
            span.recordException(error);
            span.setAttributes({ 'redis.upsert_success': false, 'redis.error': error.message });
            span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
            throw error;
         } finally {
            span.end();
         }
      });
   }

   async find(id: string) {
      const tracer = trace.getTracer('upstash-adapter', '1.0.0');
      
      return tracer.startActiveSpan('find', {
         attributes: {
            'redis.operation': 'find',
            'redis.model': this.name,
            'redis.id': id
         }
      }, async (span) => {
         try {
            const k = key(this.name, id);
            log.debug({
               functionName: 'find',
               id,
               model: this.name
            }, `RedisAdapter.find: Looking up ${this.name} with key: ${k}`);
         
            const result = await redis.get<Stored>(k);
            log.debug({ key: k, found: !!result }, 'RedisAdapter.find: Result lookup completed');
            
            if (result) {
               log.debug({
                  client_id: result.client_id,
                  client_name: result.client_name,
                  grant_types: result.grant_types,
                  response_types: result.response_types,
                  redirect_uris: result.redirect_uris,
                  token_endpoint_auth_method: result.token_endpoint_auth_method,
                  scope: result.scope
               }, `RedisAdapter.find: Client data:`);
               log.info({ model: this.name, id }, 'RedisAdapter.find: Successfully found');
            } else {
               log.debug({ model: this.name, id }, 'RedisAdapter.find: Not found in Redis');
            }
            
            span.setAttributes({
               'redis.find_success': true,
               'redis.key': k,
               'redis.found': !!result
            });
            span.setStatus({ code: SpanStatusCode.OK });
            
            return result;
         } catch (error) {
            log.error({ model: this.name, id, error: error.message }, 'RedisAdapter.find: Error during lookup');
            span.recordException(error);
            span.setAttributes({ 'redis.find_success': false, 'redis.error': error.message });
            span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
            throw error;
         } finally {
            span.end();
         }
      });
   }


   async findByUserCode(code: string) {
      const tracer = trace.getTracer('upstash-adapter', '1.0.0');
      
      return tracer.startActiveSpan('findByUserCode', {
         attributes: {
            'redis.operation': 'findByUserCode',
            'redis.model': this.name,
            'redis.user_code': code
         }
      }, async (span) => {
         try {
            log.debug({ code }, 'RedisAdapter.findByUserCode: Looking up user code');
            const id = await redis.get<string>(userCodeKey(code));
            log.debug({ id: id || 'NOT FOUND' }, 'RedisAdapter.findByUserCode: Found ID');
            
            span.setAttributes({
               'redis.find_by_user_code_success': true,
               'redis.found_id': !!id
            });
            span.setStatus({ code: SpanStatusCode.OK });
            
            return id ? this.find(id) : undefined;
         } catch (error) {
            span.recordException(error);
            span.setAttributes({ 'redis.find_by_user_code_success': false, 'redis.error': error.message });
            span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
            throw error;
         } finally {
            span.end();
         }
      });
   }

   async findByUid(uid: string) {
      const tracer = trace.getTracer('upstash-adapter', '1.0.0');
      
      return tracer.startActiveSpan('findByUid', {
         attributes: {
            'redis.operation': 'findByUid',
            'redis.model': this.name,
            'redis.uid': uid
         }
      }, async (span) => {
         try {
            log.debug({ uid }, 'RedisAdapter.findByUid: Looking up UID');
            const id = await redis.get<string>(uidKey(uid));
            log.debug({ id: id || 'NOT FOUND' }, 'RedisAdapter.findByUid: Found ID');
            
            span.setAttributes({
               'redis.find_by_uid_success': true,
               'redis.found_id': !!id
            });
            span.setStatus({ code: SpanStatusCode.OK });
            
            return id ? this.find(id) : undefined;
         } catch (error) {
            span.recordException(error);
            span.setAttributes({ 'redis.find_by_uid_success': false, 'redis.error': error.message });
            span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
            throw error;
         } finally {
            span.end();
         }
      });
   }

   async destroy(id: string) {
      const tracer = trace.getTracer('upstash-adapter', '1.0.0');
      
      return tracer.startActiveSpan('destroy', {
         attributes: {
            'redis.operation': 'destroy',
            'redis.model': this.name,
            'redis.id': id
         }
      }, async (span) => {
         try {
            log.info({ model: this.name, id }, 'RedisAdapter.destroy: Destroying');
            const p = await this.find(id);
            await redis.del(key(this.name, id));
            if (p?.grantId) {
               log.debug({ grantKey: grantKey(p.grantId) }, 'RedisAdapter.destroy: Removing from grant set');
               await redis.srem(grantKey(p.grantId), id);
            }
            if (p?.userCode) {
               log.debug({ userCodeKey: userCodeKey(p.userCode) }, 'RedisAdapter.destroy: Removing user code');
               await redis.del(userCodeKey(p.userCode));
            }
            if (p?.uid) {
               log.debug({ uidKey: uidKey(p.uid) }, 'RedisAdapter.destroy: Removing UID');
               await redis.del(uidKey(p.uid));
            }
            log.info({ model: this.name, id }, 'RedisAdapter.destroy: Successfully destroyed');
            
            span.setAttributes({
               'redis.destroy_success': true,
               'redis.had_grant_id': !!p?.grantId,
               'redis.had_user_code': !!p?.userCode,
               'redis.had_uid': !!p?.uid
            });
            span.setStatus({ code: SpanStatusCode.OK });
         } catch (error) {
            span.recordException(error);
            span.setAttributes({ 'redis.destroy_success': false, 'redis.error': error.message });
            span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
            throw error;
         } finally {
            span.end();
         }
      });
   }

   async revokeByGrantId(grantId: string) {
      const tracer = trace.getTracer('upstash-adapter', '1.0.0');
      
      return tracer.startActiveSpan('revokeByGrantId', {
         attributes: {
            'redis.operation': 'revokeByGrantId',
            'redis.model': this.name,
            'redis.grant_id': grantId
         }
      }, async (span) => {
         try {
            log.info({ grantId }, 'RedisAdapter.revokeByGrantId: Revoking grant');
            const ids = await redis.smembers(grantKey(grantId)) as string[];
            log.debug({ itemCount: ids?.length || 0 }, 'RedisAdapter.revokeByGrantId: Found items to revoke');
            
            // Delete all associated entities
            if (ids?.length) {
               await Promise.all(ids.map(id => redis.del(key(this.name, id))));
            }
            
            // Delete the grant set itself
            await redis.del(grantKey(grantId));
            
            // Delete the actual grant data (oidc:Grant:{grantId})
            await redis.del(key('Grant', grantId));
            
            log.info({ 
               grantId, 
               itemsRevoked: ids?.length || 0,
               grantDataDeleted: true,
               grantSetDeleted: true
            }, 'RedisAdapter.revokeByGrantId: Successfully revoked grant and all associated data');
            
            span.setAttributes({
               'redis.revoke_success': true,
               'redis.items_revoked': ids?.length || 0
            });
            span.setStatus({ code: SpanStatusCode.OK });
         } catch (error) {
            span.recordException(error);
            span.setAttributes({ 'redis.revoke_success': false, 'redis.error': error.message });
            span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
            throw error;
         } finally {
            span.end();
         }
      });
   }

   async consume(id: string) {
      const tracer = trace.getTracer('upstash-adapter', '1.0.0');
      
      return tracer.startActiveSpan('consume', {
         attributes: {
            'redis.operation': 'consume',
            'redis.model': this.name,
            'redis.id': id
         }
      }, async (span) => {
         try {
            log.info({ model: this.name, id }, 'RedisAdapter.consume: Consuming');
            const k = key(this.name, id);
            const p = await redis.get<Stored>(k);
            if (!p) {
               log.warn({ model: this.name, id }, 'RedisAdapter.consume: Not found, cannot consume');
               span.setAttributes({ 'redis.consume_success': false, 'redis.item_not_found': true });
               span.setStatus({ code: SpanStatusCode.OK });
               return;
            }
            p.consumed = Math.floor(Date.now() / 1000);
            const ttl = await redis.ttl(k);
            if (ttl > 0) {
               log.debug({ ttl }, 'RedisAdapter.consume: Setting consumed with TTL');
               await redis.set(k, p, { ex: ttl });
            } else {
               log.debug({}, 'RedisAdapter.consume: Setting consumed without TTL');
               await redis.set(k, p);
            }
            log.info({ model: this.name, id }, 'RedisAdapter.consume: Successfully consumed');
            
            span.setAttributes({
               'redis.consume_success': true,
               'redis.item_found': true,
               'redis.ttl': ttl
            });
            span.setStatus({ code: SpanStatusCode.OK });
         } catch (error) {
            span.recordException(error);
            span.setAttributes({ 'redis.consume_success': false, 'redis.error': error.message });
            span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
            throw error;
         } finally {
            span.end();
         }
      });
   }
}

export default class UpstashAdapter {
   static async connect() {
      const tracer = trace.getTracer('upstash-adapter', '1.0.0');
      
      return tracer.startActiveSpan('connect', {
         attributes: {
            'redis.operation': 'connect',
            'redis.adapter_type': 'upstash'
         }
      }, async (span) => {
         try {
            // Use global cache manager
            redis = await GlobalCacheManager.getInstance('auth-server');

            log.info({
               redisConnected: true,
               purpose: 'oidc_provider_storage',
               sharedConnection: true
            }, 'UpstashAdapter connected using global cache manager');
            
            span.setAttributes({
               'redis.connect_success': true,
               'redis.shared_connection': true,
               'redis.manager_type': 'global-cache'
            });
            span.setStatus({ code: SpanStatusCode.OK });
            
            return UpstashAdapter;
         } catch (error) {
            log.error({
               error: error.message,
               stack: error.stack
            }, 'UpstashAdapter.connect: Failed to get global cache connection');
            
            span.recordException(error);
            span.setAttributes({ 
               'redis.connect_success': false, 
               'redis.error': error.message,
               'redis.shared_connection': false
            });
            span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
            throw error;
         } finally {
            span.end();
         }
      });
   }

   constructor(name: string) {
      log.info({ model: name }, 'UpstashAdapter: Creating adapter for model');
      log.debug({ available: !!redis }, `UpstashAdapter: Redis instance available`);
      return new RedisAdapter(name);
   }
}