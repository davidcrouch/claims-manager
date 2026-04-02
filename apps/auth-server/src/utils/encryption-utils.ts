/**
 * =============================================================================
 * ENCRYPTION UTILITIES
 * =============================================================================
 * 
 * This module provides encryption and decryption utilities for token storage
 * in the auth server token exchange system.
 * 
 * Key Features:
 * - AES-256-GCM encryption for tokens
 * - Secure random generation
 * - Key derivation and management
 * - IV generation and handling
 * 
 * @author AI Assistant
 * @version 1.0.0
 * @since 2025-01-30
 */

import { createHash, randomBytes, createCipheriv, createDecipheriv, scrypt } from 'crypto';
import { promisify } from 'util';
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';

const baseLogger = createLogger('auth-server:encryption-utils', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'encryption-utils', 'EncryptionUtils', 'auth-server');

// =============================================================================
// ENCRYPTION CONFIGURATION
// =============================================================================

/**
 * Encryption configuration interface
 */
export interface EncryptionConfig {
  /** Encryption algorithm */
  algorithm: string;
  
  /** Key length in bytes */
  keyLength: number;
  
  /** IV length in bytes */
  ivLength: number;
  
  /** Secret key for encryption */
  secretKey: string;
  
  /** Whether to use authenticated encryption */
  authenticated: boolean;
  
  /** Additional encryption options */
  options?: Record<string, any>;
}

/**
 * Default encryption configuration
 */
const DEFAULT_ENCRYPTION_CONFIG: EncryptionConfig = {
  algorithm: 'aes-256-gcm',
  keyLength: 32, // 256 bits
  ivLength: 16,  // 128 bits
  secretKey: process.env.ENCRYPTION_SECRET_KEY || '',
  authenticated: true,
  options: {}
};

// =============================================================================
// ENCRYPTION UTILITY CLASS
// =============================================================================

/**
 * Encryption utility class for token encryption and decryption
 */
export class EncryptionUtils {
  private config: EncryptionConfig;
  private derivedKey: Buffer | null = null;

  constructor(config: Partial<EncryptionConfig> = {}) {
    this.config = { ...DEFAULT_ENCRYPTION_CONFIG, ...config };
    
    // Validate configuration
    this.validateConfig();
    
    // Derive key from secret
    this.deriveKey();
    
    log.info({
      algorithm: this.config.algorithm,
      keyLength: this.config.keyLength,
      ivLength: this.config.ivLength,
      authenticated: this.config.authenticated
    }, 'EncryptionUtils initialized');
  }

  /**
   * Validate encryption configuration
   */
  private validateConfig(): void {
    if (!this.config.secretKey) {
      throw new Error('ENCRYPTION_SECRET_KEY is required');
    }

    if (this.config.secretKey.length < 32) {
      throw new Error('ENCRYPTION_SECRET_KEY must be at least 32 characters long');
    }

    if (this.config.keyLength < 16) {
      throw new Error('Key length must be at least 16 bytes (128 bits)');
    }

    if (this.config.ivLength < 12) {
      throw new Error('IV length must be at least 12 bytes (96 bits) for GCM mode');
    }

    log.debug({
      configValid: true,
      algorithm: this.config.algorithm,
      keyLength: this.config.keyLength,
      ivLength: this.config.ivLength
    }, 'Encryption configuration validated');
  }

  /**
   * Derive encryption key from secret
   */
  private async deriveKey(): Promise<void> {
    try {
      const scryptAsync = promisify(scrypt);
      const salt = createHash('sha256').update(this.config.secretKey).digest();
      
      this.derivedKey = await scryptAsync(this.config.secretKey, salt, this.config.keyLength) as Buffer;
      
      log.debug({
        keyDerived: true,
        keyLength: this.derivedKey.length
      }, 'Encryption key derived successfully');
    } catch (error) {
      log.error({ functionName: 'deriveKey', error: error.message }, 'Failed to derive encryption key');
      throw new Error('Failed to derive encryption key');
    }
  }

  /**
   * Generate a secure random IV
   */
  public generateIV(): Buffer {
    try {
      const iv = randomBytes(this.config.ivLength);
      
      log.debug({
        ivGenerated: true,
        ivLength: iv.length
      }, 'Random IV generated');
      
      return iv;
    } catch (error) {
      log.error({ functionName: 'generateIV', error: error.message }, 'Failed to generate IV');
      throw new Error('Failed to generate IV');
    }
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  public async encrypt(data: string): Promise<EncryptedData> {
    const tracer = trace.getTracer('encryption-utils', '1.0.0');
    
    return tracer.startActiveSpan('encrypt', {
      attributes: {
        'encryption.operation': 'encrypt',
        'encryption.algorithm': this.config.algorithm,
        'encryption.authenticated': this.config.authenticated,
        'encryption.data_length': data.length,
        'encryption.has_derived_key': !!this.derivedKey
      }
    }, async (span) => {
      try {
        if (!this.derivedKey) {
          throw new Error('Encryption key not available');
        }

      const iv = this.generateIV();
      const cipher = createCipheriv(this.config.algorithm, this.derivedKey, iv);
      
      if (this.config.authenticated && 'setAAD' in cipher) {
        // Set additional authenticated data if needed
        (cipher as any).setAAD(Buffer.from('token-exchange', 'utf8'));
      }

      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = this.config.authenticated && 'getAuthTag' in cipher 
        ? (cipher as any).getAuthTag() 
        : null;

      const result: EncryptedData = {
        encryptedData: encrypted,
        iv: iv.toString('hex'),
        algorithm: this.config.algorithm,
        keyVersion: '1.0',
        encryptedAt: Date.now()
      };

      if (authTag) {
        result.authTag = authTag.toString('hex');
      }

        span.setAttributes({
          'encryption.success': true,
          'encryption.data_length': data.length,
          'encryption.encrypted_length': encrypted.length,
          'encryption.has_auth_tag': !!authTag,
          'encryption.key_version': result.keyVersion
        });
        span.setStatus({ code: SpanStatusCode.OK });

        return result;
      } catch (error) {
        log.error({ 
          functionName: 'encrypt',
          error: error.message,
          algorithm: this.config.algorithm
        }, 'Failed to encrypt data');
        
        span.recordException(error);
        span.setAttributes({ 'encryption.success': false, 'encryption.error': error.message });
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        
        throw new Error('Failed to encrypt data');
      } finally {
        span.end();
      }
    });
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  public async decrypt(encryptedData: EncryptedData): Promise<string> {
    const tracer = trace.getTracer('encryption-utils', '1.0.0');
    
    return tracer.startActiveSpan('decrypt', {
      attributes: {
        'encryption.operation': 'decrypt',
        'encryption.algorithm': encryptedData.algorithm,
        'encryption.authenticated': this.config.authenticated,
        'encryption.encrypted_length': encryptedData.encryptedData.length,
        'encryption.has_derived_key': !!this.derivedKey,
        'encryption.has_auth_tag': !!encryptedData.authTag
      }
    }, async (span) => {
      try {
        if (!this.derivedKey) {
          throw new Error('Encryption key not available');
        }

      const iv = Buffer.from(encryptedData.iv, 'hex');
      const decipher = createDecipheriv(this.config.algorithm, this.derivedKey, iv);

      if (this.config.authenticated && encryptedData.authTag) {
        if ('setAuthTag' in decipher) {
          (decipher as any).setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
        }
        if ('setAAD' in decipher) {
          (decipher as any).setAAD(Buffer.from('token-exchange', 'utf8'));
        }
      }

      let decrypted = decipher.update(encryptedData.encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

        span.setAttributes({
          'encryption.success': true,
          'encryption.encrypted_length': encryptedData.encryptedData.length,
          'encryption.decrypted_length': decrypted.length,
          'encryption.algorithm': encryptedData.algorithm,
          'encryption.has_auth_tag': !!encryptedData.authTag
        });
        span.setStatus({ code: SpanStatusCode.OK });

        return decrypted;
      } catch (error) {
        log.error({ 
          functionName: 'decrypt',
          error: error.message,
          algorithm: encryptedData.algorithm,
          hasAuthTag: !!encryptedData.authTag
        }, 'Failed to decrypt data');
        
        span.recordException(error);
        span.setAttributes({ 'encryption.success': false, 'encryption.error': error.message });
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        
        throw new Error('Failed to decrypt data');
      } finally {
        span.end();
      }
    });
  }

  /**
   * Encrypt an object by serializing it first
   */
  public async encryptObject<T>(obj: T): Promise<EncryptedData> {
    try {
      const jsonString = JSON.stringify(obj);
      return await this.encrypt(jsonString);
    } catch (error) {
      log.error({ functionName: 'encryptObject', error: error.message }, 'Failed to encrypt object');
      throw new Error('Failed to encrypt object');
    }
  }

  /**
   * Decrypt data and parse it as JSON
   */
  public async decryptObject<T>(encryptedData: EncryptedData): Promise<T> {
    try {
      const jsonString = await this.decrypt(encryptedData);
      return JSON.parse(jsonString) as T;
    } catch (error) {
      log.error({ functionName: 'decryptObject', error: error.message }, 'Failed to decrypt object');
      throw new Error('Failed to decrypt object');
    }
  }

  /**
   * Generate a secure random string
   */
  public generateRandomString(length: number): string {
    try {
      const bytes = randomBytes(Math.ceil(length / 2));
      const randomString = bytes.toString('hex').slice(0, length);
      
      log.debug({
        requestedLength: length,
        generatedLength: randomString.length
      }, 'Random string generated');
      
      return randomString;
    } catch (error) {
      log.error({ functionName: 'generateRandomString', error: error.message, length }, 'Failed to generate random string');
      throw new Error('Failed to generate random string');
    }
  }

  /**
   * Generate a secure random token
   */
  public generateToken(length: number = 32): string {
    return this.generateRandomString(length);
  }

  /**
   * Hash data using SHA-256
   */
  public hash(data: string): string {
    try {
      const hash = createHash('sha256');
      hash.update(data);
      const hashed = hash.digest('hex');
      
      log.debug({
        dataLength: data.length,
        hashLength: hashed.length
      }, 'Data hashed successfully');
      
      return hashed;
    } catch (error) {
      log.error({ functionName: 'hash', error: error.message }, 'Failed to hash data');
      throw new Error('Failed to hash data');
    }
  }

  /**
   * Verify data against a hash
   */
  public verifyHash(data: string, hash: string): boolean {
    try {
      const dataHash = this.hash(data);
      const isValid = dataHash === hash;
      
      log.debug({
        dataLength: data.length,
        hashLength: hash.length,
        isValid
      }, 'Hash verification completed');
      
      return isValid;
    } catch (error) {
      log.error({ functionName: 'verifyHash', error: error.message }, 'Failed to verify hash');
      return false;
    }
  }

  /**
   * Get encryption configuration
   */
  public getConfig(): EncryptionConfig {
    return { ...this.config };
  }

  /**
   * Update encryption configuration
   */
  public updateConfig(newConfig: Partial<EncryptionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.validateConfig();
    this.deriveKey();
    
    log.info({
      configUpdated: true,
      algorithm: this.config.algorithm,
      keyLength: this.config.keyLength
    }, 'Encryption configuration updated');
  }
}

// =============================================================================
// ENCRYPTED DATA INTERFACE
// =============================================================================

/**
 * Encrypted data structure
 */
export interface EncryptedData {
  /** Encrypted data as hex string */
  encryptedData: string;
  
  /** Initialization vector as hex string */
  iv: string;
  
  /** Authentication tag (for authenticated encryption) */
  authTag?: string;
  
  /** Encryption algorithm used */
  algorithm: string;
  
  /** Key version */
  keyVersion: string;
  
  /** Timestamp of encryption */
  encryptedAt: number;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Create a new encryption utils instance
 */
export function createEncryptionUtils(config?: Partial<EncryptionConfig>): EncryptionUtils {
  return new EncryptionUtils(config);
}

/**
 * Get default encryption configuration
 */
export function getDefaultEncryptionConfig(): EncryptionConfig {
  return { ...DEFAULT_ENCRYPTION_CONFIG };
}

/**
 * Validate encryption configuration
 */
export function validateEncryptionConfig(config: Partial<EncryptionConfig>): boolean {
  try {
    const fullConfig = { ...DEFAULT_ENCRYPTION_CONFIG, ...config };
    
    if (!fullConfig.secretKey || fullConfig.secretKey.length < 32) {
      return false;
    }
    
    if (fullConfig.keyLength < 16) {
      return false;
    }
    
    if (fullConfig.ivLength < 12) {
      return false;
    }
    
    return true;
  } catch (error) {
    log.error({ functionName: 'validateEncryptionConfig', error: error.message }, 'Encryption configuration validation failed');
    return false;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default EncryptionUtils;
