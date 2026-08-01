import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm' as const;

export function encrypt(plaintext: string, key: Buffer): string {
   const iv = randomBytes(12);
   const cipher = createCipheriv(ALGO, key, iv);
   const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
   const tag = cipher.getAuthTag();
   return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decrypt(ciphertext: string, key: Buffer): string {
   const buf = Buffer.from(ciphertext, 'base64');
   const iv = buf.subarray(0, 12);
   const tag = buf.subarray(12, 28);
   const data = buf.subarray(28);
   const decipher = createDecipheriv(ALGO, key, iv);
   decipher.setAuthTag(tag);
   return decipher.update(data).toString('utf8') + decipher.final('utf8');
}

let _encryptionKey: Buffer | null = null;
let _initialized = false;

export function getRedisEncryptionKey(): Buffer | null {
   if (_initialized) return _encryptionKey;
   _initialized = true;

   const hexKey = process.env.REDIS_ENCRYPTION_KEY;
   if (!hexKey) {
      if (process.env.NODE_ENV === 'production') {
         throw new Error('auth-server:redis-encryption:getRedisEncryptionKey - REDIS_ENCRYPTION_KEY is required in production (tokens must be encrypted at rest)');
      }
      console.warn('auth-server:redis-encryption:getRedisEncryptionKey - REDIS_ENCRYPTION_KEY not set (development only): tokens stored unencrypted in Redis.');
      return null;
   }

   const keyBuf = Buffer.from(hexKey, 'hex');
   if (keyBuf.length !== 32) {
      throw new Error(`auth-server:redis-encryption:getRedisEncryptionKey - REDIS_ENCRYPTION_KEY must be 32 bytes (64 hex chars), got ${keyBuf.length} bytes`);
   }
   _encryptionKey = keyBuf;
   return _encryptionKey;
}
