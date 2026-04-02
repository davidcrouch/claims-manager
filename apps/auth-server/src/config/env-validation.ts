
import { getServiceName as getServiceNameUtil, getServiceVersion as getServiceVersionUtil } from '../lib/service-config.js';

/**
 * Validate all environment variables for Auth Server
 * This should be called at application startup
 */
export function validateAuthServerEnvironment(): boolean {
   console.info({ 
      action: 'environment_validation',
      service: 'auth_server'
   }, 'Starting Auth Server environment validation');

   try {
      // Service identification validation
      getServiceName();
      getServiceVersion();
      
      // Call each getter function - they will throw if validation fails
      getOidcIssuer();
      getJwtSecret();
      getRedisConfig();
      getClientId();
      getClientSecret();
      getClientCallbackUrl();
      getPostLoginRedirectUrl();
      getPostLogoutRedirectUrl();

      // Optional variables with validation
      getServerConfig();
      getCorsOrigins();
      getGoogleOAuthConfig();
      getBaseUrl();
      getConsoleSharedSecret();
      getIatSigningKey();
      getApiUrl();
//      getMcpBaseUrl();
      getRateLimitConfig();
      getTokenTtlConfig();

      // JWKS validation (optional but recommended for production)
      try {
         getJwksConfig();
      } catch (error) {
         console.warn({ 
            jwksNotFound: true,
            fallback: 'development_keys'
         }, 'JWKS configuration not found - using development keys');
      }

      console.info({ 
         validationCompleted: true,
         service: 'auth_server'
      }, 'Auth Server environment validation completed successfully');
      return true;
   } catch (error) {
      console.error({ error: error.message }, 'Auth Server environment validation failed');
      console.error({ 
         action: 'validation_failed',
         service: 'auth_server'
      }, 'Please check the environment variables and restart the application.');
      return false;
   }
}

/**
 * Get validated environment variable value
 * This should be used instead of direct process.env access
 */
export function getEnvVar(name: string): string | undefined {
   return process.env[name];
}

/**
 * Get validated environment variable with fallback
 */
export function getEnvVarWithDefault(name: string, defaultValue: string): string {
   return process.env[name] || defaultValue;
}

/**
 * Check if we're in production mode
 */
export function isProduction(): boolean {
   return getEnvVarWithDefault('NODE_ENV', 'development') === 'production';
}

/**
 * Get the OIDC issuer URL
 */
export function getOidcIssuer(): string {
   const issuer = getEnvVar('OIDC_ISSUER');
   if (!issuer) {
      throw new Error('OIDC_ISSUER is not set');
   }
   if (!issuer.startsWith('http')) {
      throw new Error('OIDC_ISSUER must be a valid URL (e.g., https://morezero-auth-server.fly.dev)');
   }
   return issuer;
}

/**
 * Get JWT secret
 */
export function getJwtSecret(): string {
   const secret = getEnvVar('JWT_SECRET');
   if (!secret) {
      throw new Error('JWT_SECRET is not set');
   }
   if (secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long (currently ' + secret.length + ' characters)');
   }
   return secret;
}

/**
 * Get client ID
 */
export function getClientId(): string {
   const clientId = getEnvVar('OIDC_CLIENT_ID');
   if (!clientId) {
      throw new Error('OIDC_CLIENT_ID is not set');
   }
   return clientId;
}

/**
 * Get client secret
 */
export function getClientSecret(): string {
   const clientSecret = getEnvVar('OIDC_CLIENT_SECRET');
   if (!clientSecret) {
      throw new Error('OIDC_CLIENT_SECRET is not set');
   }
   return clientSecret;
}

/**
 * Get client redirect URI
 */
export function getClientCallbackUrl(): string {
   const redirectUri = getEnvVar('OIDC_CLIENT_CALLBACK_URI');
   if (!redirectUri) {
      throw new Error('OIDC_CLIENT_CALLBACK_URI is not set');
   }
   if (!redirectUri.startsWith('http')) {
      throw new Error('OIDC_CLIENT_CALLBACK_URI must be a valid URL (currently ' + redirectUri + ')');
   }
   return redirectUri;
}

/**
 * Get additional redirect URIs for multiple client applications
 * Returns an array of validated redirect URIs from OIDC_ADDITIONAL_REDIRECT_URIS (comma-separated)
 */
export function getAdditionalRedirectUris(): string[] {
   const additionalUris = getEnvVar('OIDC_ADDITIONAL_REDIRECT_URIS');
   if (!additionalUris) {
      return [];
   }

   const uriList = additionalUris.split(',').map(uri => uri.trim()).filter(uri => uri.length > 0);
   const invalidUris = uriList.filter(uri => !uri.startsWith('http'));

   if (invalidUris.length > 0) {
      throw new Error('OIDC_ADDITIONAL_REDIRECT_URIS must be a comma-separated list of valid URLs. Invalid: ' + invalidUris.join(', '));
   }

   return uriList;
}

/**
 * Get all redirect URIs (primary + additional)
 */
export function getAllRedirectUris(): string[] {
   const primaryUri = getClientCallbackUrl();
   const additionalUris = getAdditionalRedirectUris();
   return [primaryUri, ...additionalUris];
}

/**
 * Get post-login redirect URI
 */
export function getPostLoginRedirectUrl(): string {
   const postLoginUri = getEnvVar('OIDC_POST_LOGIN_URI');
   if (!postLoginUri) {
      throw new Error('OIDC_POST_LOGIN_URI is not set');
   }
   if (!postLoginUri.startsWith('http')) {
      throw new Error('OIDC_POST_LOGIN_URI must be a valid URL (currently ' + postLoginUri + ')');
   }
   return postLoginUri;
}

/**
 * Get post-logout redirect URI
 */
export function getPostLogoutRedirectUrl(): string {
   const postLogoutUri = getEnvVar('OIDC_POST_LOGOUT_URI');
   if (!postLogoutUri) {
      throw new Error('OIDC_POST_LOGOUT_URI is not set');
   }
   if (!postLogoutUri.startsWith('http')) {
      throw new Error('OIDC_POST_LOGOUT_URI must be a valid URL (currently ' + postLogoutUri + ')');
   }
   return postLogoutUri;
}

/**
 * Get Redis configuration
 */
export function getRedisConfig() {
   const provider = getEnvVarWithDefault('REDIS_PROVIDER', 'self-hosted');

   if (provider === 'upstash') {
      const url = getEnvVar('UPSTASH_REDIS_REST_URL');
      const token = getEnvVar('UPSTASH_REDIS_REST_TOKEN');

      if (!url) {
         throw new Error('UPSTASH_REDIS_REST_URL is not set');
      }
      if (!token) {
         throw new Error('UPSTASH_REDIS_REST_TOKEN is not set');
      }
      if (!url.startsWith('http')) {
         throw new Error('UPSTASH_REDIS_REST_URL must be a valid HTTP URL (currently ' + url + ')');
      }

      return {
         provider: 'upstash' as const,
         url,
         token
      };
   }

   if (provider !== 'self-hosted') {
      throw new Error("REDIS_PROVIDER must be either 'self-hosted' or 'upstash'");
   }

   const host = getEnvVarWithDefault('REDIS_HOST', 'localhost');
   const portRaw = getEnvVarWithDefault('REDIS_PORT', '6379');
   const port = parseInt(portRaw, 10);

   if (!host) {
      throw new Error('REDIS_HOST must not be empty');
   }
   if (Number.isNaN(port) || port < 1 || port > 65535) {
      throw new Error('REDIS_PORT must be a valid port number (1-65535)');
   }

   return {
      provider: 'self-hosted' as const,
      host,
      port,
      password: getEnvVar('REDIS_PASSWORD'),
      db: parseInt(getEnvVarWithDefault('REDIS_DB', '0'), 10),
      tls: getEnvVarWithDefault('REDIS_TLS', 'false') === 'true'
   };
}

/**
 * Get server configuration
 */
export function getServerConfig() {
   const port = parseInt(getEnvVarWithDefault('PORT', '3001'), 10);
   const host = getEnvVarWithDefault('HOST', '0.0.0.0');
   const environment = getEnvVarWithDefault('NODE_ENV', 'development');

   if (port < 1 || port > 65535) {
      throw new Error('PORT must be a valid port number (1-65535)');
   }

   if (!['development', 'production', 'test'].includes(environment)) {
      throw new Error('NODE_ENV must be one of: development, production, test');
   }

   return {
      port,
      host,
      environment,
      oidcIssuer: getOidcIssuer()
   };
}

/**
 * Get CORS origins
 */
export function getCorsOrigins(): string[] {
   const origins = getEnvVar('CORS_ORIGINS');
   if (!origins) {
      // CORS_ORIGINS is not set - using default
      return ['http://localhost:3000'];
   }

   const originList = origins.split(',').map(origin => origin.trim());
   const invalidOrigins = originList.filter(origin => !origin.startsWith('http'));

   if (invalidOrigins.length > 0) {
      throw new Error('CORS_ORIGINS must be a comma-separated list of valid URLs');
   }

   return originList;
}

/**
 * Get base URL
 */
export function getBaseUrl(): string {
  const baseUrl = getEnvVar('BASE_URL');
  if (!baseUrl) {
    throw new Error('BASE_URL is not set');
  }
  if (!baseUrl.startsWith('http')) {
    throw new Error('BASE_URL must be a valid URL');
  }
  return baseUrl;
}

/**
 * Get Google OAuth configuration
 */
export function getGoogleOAuthConfig() {
   const clientId = getEnvVar('GOOGLE_CLIENT_ID');
   const clientSecret = getEnvVar('GOOGLE_CLIENT_SECRET');

   if (!clientId && !clientSecret) {
      return null; // Both missing, Google OAuth not configured
   }

   if (!clientId) {
      throw new Error('GOOGLE_CLIENT_ID is required when Google OAuth is configured');
   }

   if (!clientSecret) {
      throw new Error('GOOGLE_CLIENT_SECRET is required when Google OAuth is configured');
   }

   return {
      clientId,
      clientSecret,
      redirectUri: `${getOidcIssuer()}/login/google/callback`
   };
}

/**
 * Get console shared secret
 */
export function getConsoleSharedSecret(): string | null {
   const secret = getEnvVar('DYNAMIC_REGISTRATION_SECRET');
   if (secret && secret.length === 0) {
      throw new Error('DYNAMIC_REGISTRATION_SECRET must not be empty when provided');
   }
   return secret || null;
}

/**
 * Get IAT signing key
 */
export function getIatSigningKey(): string | null {
   const key = getEnvVar('DCR_IAT_SIGNING_KEY');
   if (key) {
      try {
         Buffer.from(key, 'base64');
      } catch {
         throw new Error('DCR_IAT_SIGNING_KEY must be a valid base64-encoded string when provided');
      }
   }
   return key || null;
}

/**
 * Get API URL for IAT validation
 */
export function getApiUrl(): string | null {
   const url = getEnvVar('MOREZERO_API_URL');
   if (url && !url.startsWith('http')) {
      throw new Error('MOREZERO_API_URL must be a valid URL when provided');
   }
   return url || null;
}

export function getMcpBaseUrl(): string {
   const url = getEnvVar('MOREZERO_MCP_URL');
   if (!url) {
      throw new Error('MOREZERO_MCP_URL environment variable is required');
   }
   if (!url.startsWith('http')) {
      throw new Error('MOREZERO_MCP_URL must be a valid HTTP/HTTPS URL');
   }
   return url;
}


/**
 * Get JWKS configuration for JWT signing
 */
export function getJwksConfig(): any {
   
   // Load RSA key components
   const n = getEnvVar('JWT_PUBLIC_KEY_N');
   const e = getEnvVar('JWT_PUBLIC_KEY_E');
   const d = getEnvVar('JWT_PRIVATE_KEY_D');
   const p = getEnvVar('JWT_PRIVATE_KEY_P');
   const q = getEnvVar('JWT_PRIVATE_KEY_Q');
   const dp = getEnvVar('JWT_PRIVATE_KEY_DP');
   const dq = getEnvVar('JWT_PRIVATE_KEY_DQ');
   const qi = getEnvVar('JWT_PRIVATE_KEY_QI');

   // Load EC key components (optional)
   const ecD = getEnvVar('JWT_EC_PRIVATE_KEY_D');
   const ecX = getEnvVar('JWT_EC_PUBLIC_KEY_X');
   const ecY = getEnvVar('JWT_EC_PUBLIC_KEY_Y');

      

   // Validate RSA key components (required)
   if (!n || !e || !d || !p || !q || !dp || !dq || !qi) {
      const missing = [];
      if (!n) missing.push('JWT_PUBLIC_KEY_N');
      if (!e) missing.push('JWT_PUBLIC_KEY_E');
      if (!d) missing.push('JWT_PRIVATE_KEY_D');
      if (!p) missing.push('JWT_PRIVATE_KEY_P');
      if (!q) missing.push('JWT_PRIVATE_KEY_Q');
      if (!dp) missing.push('JWT_PRIVATE_KEY_DP');
      if (!dq) missing.push('JWT_PRIVATE_KEY_DQ');
      if (!qi) missing.push('JWT_PRIVATE_KEY_QI');
      
      throw new Error(`RSA JWKS configuration incomplete - missing: ${missing.join(', ')}`);
   }

   // Build JWKS configuration
   const jwks: any = {
      keys: [
         // RSA-2048 key
         {
            kid: 'rsa-sig-2025', // Key ID for JWKS lookup
            alg: 'RS256',        // Algorithm hint
            kty: 'RSA',
            use: 'sig',
            n: n,
            e: e,
            d: d,
            p: p,
            q: q,
            dp: dp,
            dq: dq,
            qi: qi,
         }
      ]
   };

   // Add EC P-256 key if all components are available
   if (ecD && ecX && ecY) {
      jwks.keys.push({
         kid: 'ec-sig-2025', // Key ID for JWKS lookup
         alg: 'ES256',       // Algorithm hint
         kty: 'EC',
         use: 'sig',
         crv: 'P-256',
         x: ecX,
         y: ecY,
         d: ecD,
      });

   } 

   return jwks;
}

/**
 * Get and validate service name
 * 
 * Priority order:
 * 1. SERVICE_NAME environment variable
 * 2. OTEL_SERVICE_NAME environment variable (OpenTelemetry standard)
 * 3. npm_package_name (from package.json via npm/pnpm)
 * 4. Throws error if none available
 */
export function getServiceName(): string {
  const serviceName = getServiceNameUtil(''); // Empty fallback to force validation
  
  if (!serviceName || serviceName.trim() === '') {
    throw new Error(
      'Service name is required. Set one of: SERVICE_NAME, OTEL_SERVICE_NAME environment variables, ' +
      'or ensure package.json name is available via npm/pnpm'
    );
  }
  
  // Validate service name format (kebab-case recommended)
  if (!/^[a-z0-9-]+$/.test(serviceName)) {
    console.warn(`Service name "${serviceName}" should use kebab-case format (e.g., "auth-server")`);
  }
  
  return serviceName;
}

/**
 * Get and validate service version
 * 
 * Priority order:
 * 1. SERVICE_VERSION environment variable
 * 2. npm_package_version (from package.json via npm/pnpm)
 * 3. Throws error if none available
 */
export function getServiceVersion(): string {
  const serviceVersion = getServiceVersionUtil(''); // Empty fallback to force validation
  
  if (!serviceVersion || serviceVersion.trim() === '') {
    throw new Error(
      'Service version is required. Set SERVICE_VERSION environment variable ' +
      'or ensure package.json version is available via npm/pnpm'
    );
  }
  
  // Validate version format (semantic versioning recommended)
  if (!/^\d+\.\d+\.\d+/.test(serviceVersion)) {
    console.warn(`Service version "${serviceVersion}" should follow semantic versioning (e.g., "1.0.0")`);
  }
  
  return serviceVersion;
}

/**
 * Get rate limit window in milliseconds
 */
export function getRateLimitWindowMs(): number {
  const windowMs = parseInt(getEnvVarWithDefault('RATE_LIMIT_WINDOW_MS', '60'), 10);
  
  if (windowMs < 1 || windowMs > 3600) {
    throw new Error('RATE_LIMIT_WINDOW_MS must be between 1 and 3600 seconds (1 hour)');
  }
  
  return windowMs * 1000; // Convert to milliseconds
}

/**
 * Get rate limit maximum requests per window
 */
export function getRateLimitMaxRequests(): number {
  const maxRequests = parseInt(getEnvVarWithDefault('RATE_LIMIT_MAX_REQUESTS', '1000'), 10);
  
  if (maxRequests < 1 || maxRequests > 100000) {
    throw new Error('RATE_LIMIT_MAX_REQUESTS must be between 1 and 100,000');
  }
  
  return maxRequests;
}

/**
 * Get rate limit maximum requests for authentication endpoints
 */
export function getRateLimitAuthMaxRequests(): number {
  const authMax = parseInt(getEnvVarWithDefault('RATE_LIMIT_AUTH_MAX_REQUESTS', '50'), 10);
  
  if (authMax < 1 || authMax > 10000) {
    throw new Error('RATE_LIMIT_AUTH_MAX_REQUESTS must be between 1 and 10,000');
  }
  
  return authMax;
}

/**
 * Get rate limit maximum requests for token endpoints
 */
export function getRateLimitTokenMaxRequests(): number {
  const tokenMax = parseInt(getEnvVarWithDefault('RATE_LIMIT_TOKEN_MAX_REQUESTS', '200'), 10);
  
  if (tokenMax < 1 || tokenMax > 10000) {
    throw new Error('RATE_LIMIT_TOKEN_MAX_REQUESTS must be between 1 and 10,000');
  }
  
  return tokenMax;
}

/**
 * Get rate limit maximum requests for OAuth endpoints
 */
export function getRateLimitOauthMaxRequests(): number {
  const oauthMax = parseInt(getEnvVarWithDefault('RATE_LIMIT_OAUTH_MAX_REQUESTS', '300'), 10);
  
  if (oauthMax < 1 || oauthMax > 10000) {
    throw new Error('RATE_LIMIT_OAUTH_MAX_REQUESTS must be between 1 and 10,000');
  }
  
  return oauthMax;
}

/**
 * Get access token TTL in seconds
 */
export function getAccessTokenTtl(): number {
  const ttl = parseInt(getEnvVarWithDefault('OIDC_ACCESS_TOKEN_TTL', '3600'), 10);
  
  if (ttl < 60 || ttl > 604800) {
    throw new Error('OIDC_ACCESS_TOKEN_TTL must be between 60 and 86400 seconds (1 minute to 24 hours)');
  }
  
  return ttl;
}

/**
 * Get refresh token TTL in seconds
 */
export function getRefreshTokenTtl(): number {
  const ttl = parseInt(getEnvVarWithDefault('OIDC_REFRESH_TOKEN_TTL', '604800'), 10);
  
  if (ttl < 120 || ttl > 2592000) {
    throw new Error('OIDC_REFRESH_TOKEN_TTL must be between 3600 and 2592000 seconds (1 hour to 30 days)');
  }
  
  return ttl;
}

/**
 * Get ID token TTL in seconds
 */
export function getIdTokenTtl(): number {
  const ttl = parseInt(getEnvVarWithDefault('OIDC_ID_TOKEN_TTL', '3600'), 10);
  
  if (ttl < 60 || ttl > 604800) {
    throw new Error('OIDC_ID_TOKEN_TTL must be between 60 and 86400 seconds (1 minute to 24 hours)');
  }
  
  return ttl;
}

/**
 * Get authorization code TTL in seconds
 */
export function getAuthorizationCodeTtl(): number {
  const ttl = parseInt(getEnvVarWithDefault('OIDC_AUTHORIZATION_CODE_TTL', '600'), 10);
  
  if (ttl < 60 || ttl > 3600) {
    throw new Error('OIDC_AUTHORIZATION_CODE_TTL must be between 60 and 3600 seconds (1 minute to 1 hour)');
  }
  
  return ttl;
}

/**
 * Get session TTL in seconds
 */
export function getSessionTtl(): number {
  const ttl = parseInt(getEnvVarWithDefault('OIDC_SESSION_TTL', '604800'), 10);
  
  if (ttl < 120 || ttl > 2592000) {
    throw new Error('OIDC_SESSION_TTL must be between 3600 and 2592000 seconds (1 hour to 30 days)');
  }
  return ttl;
}

/**
 * Get interaction TTL in seconds
 */
export function getInteractionTtl(): number {
  const ttl = parseInt(getEnvVarWithDefault('OIDC_INTERACTION_TTL', '3600'), 10);
  
  if (ttl < 60 || ttl > 7200) {
    throw new Error('OIDC_INTERACTION_TTL must be between 60 and 7200 seconds (1 minute to 2 hours)');
  }
  return ttl;
}

/**
 * Get complete token TTL configuration
 */
export function getTokenTtlConfig() {
  return {
    accessToken: getAccessTokenTtl(),
    refreshToken: getRefreshTokenTtl(),
    idToken: getIdTokenTtl(),
    authorizationCode: getAuthorizationCodeTtl(),
    session: getSessionTtl(),
    interaction: getInteractionTtl(),
  };
}

/**
 * Get complete rate limit configuration
 */
export function getRateLimitConfig() {
  return {
    windowMs: getRateLimitWindowMs(),
    maxRequests: getRateLimitMaxRequests(),
    authMaxRequests: getRateLimitAuthMaxRequests(),
    tokenMaxRequests: getRateLimitTokenMaxRequests(),
    oauthMaxRequests: getRateLimitOauthMaxRequests()
  };
}

/**
 * Get OIDC cookie encryption keys
 * Required for signing/encrypting OIDC provider cookies (_interaction, _session, etc.)
 * Without these keys, cookies will fail signature validation after cross-site redirects (e.g., Google OAuth)
 * 
 * Environment variable: OIDC_COOKIES_KEYS
 * Format: JSON array of base64-encoded keys, e.g., ["key1base64==", "key2base64=="]
 * Generate with: openssl rand -base64 32
 * First key is used for encryption, others for decryption (key rotation)
 */
export function getOidcCookieKeys(): string[] {
  const keysEnv = getEnvVar('OIDC_COOKIES_KEYS');
  
  if (!keysEnv) {
    // In development, generate a random key (not recommended for production)
    if (process.env.NODE_ENV !== 'production') {
      console.warn({
        warning: 'OIDC_COOKIES_KEYS not set',
        fallback: 'random_development_key'
      }, 'env-validation:getOidcCookieKeys - Using random development key for OIDC cookies. Set OIDC_COOKIES_KEYS for production.');
      // Generate a deterministic but unique key based on some stable value
      return ['development-cookie-key-do-not-use-in-production'];
    }
    throw new Error('OIDC_COOKIES_KEYS environment variable is required in production. Generate with: openssl rand -base64 32');
  }
  
  try {
    // Parse JSON array - handle both JSON array format and single-quoted array format
    let keys: string[];
    const trimmed = keysEnv.trim();
    
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      // Try to parse as JSON first
      try {
        keys = JSON.parse(trimmed);
      } catch {
        // If JSON parse fails, try replacing single quotes with double quotes
        keys = JSON.parse(trimmed.replace(/'/g, '"'));
      }
    } else {
      // Single key provided as string
      keys = [trimmed];
    }
    
    if (!Array.isArray(keys) || keys.length === 0) {
      throw new Error('OIDC_COOKIES_KEYS must be a non-empty array of keys');
    }
    
    return keys;
  } catch (error) {
    throw new Error(`Failed to parse OIDC_COOKIES_KEYS: ${error.message}. Expected JSON array format: ["key1", "key2"]`);
  }
}