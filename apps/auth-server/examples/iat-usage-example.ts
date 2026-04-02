/**
 * Initial Access Token (IAT) Usage Example
 * 
 * This example demonstrates how to use the IAT functionality for self-serve
 * Dynamic Client Registration (DCR) in MCP clients.
 */

// Using built-in fetch (Node.js 18+) instead of node-fetch
// import fetch from 'node-fetch';

// Configuration
const AUTH_ISSUER = process.env.OIDC_ISSUER || 'http://localhost:4000';

/**
 * Example 1: Get IAT from Auth Server (requires authentication)
 */
async function getInitialAccessToken(userToken: string) {
  try {
    const response = await fetch(`${AUTH_ISSUER}/oauth/initial-access-token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get IAT: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('IAT issued successfully:', {
      token: data.initial_access_token.substring(0, 20) + '...',
      expiresIn: data.expires_in,
      regEndpoint: data.as_reg_endpoint
    });

    return data;
  } catch (error) {
    console.error('Error getting IAT:', error);
    throw error;
  }
}

/**
 * Example 2: Register MCP client using IAT
 */
async function registerMcpClientWithIAT(iat: string, clientName: string) {
  try {
    const registrationData = {
      client_name: clientName,
      grant_types: ['client_credentials'],
      scope: 'mcp:read mcp:write mcp:invoke',
      token_endpoint_auth_method: 'client_secret_basic'
    };

    const response = await fetch(`${AUTH_ISSUER}/reg`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${iat}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(registrationData)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Registration failed: ${response.status} ${response.statusText} - ${errorData.error || 'Unknown error'}`);
    }

    const client = await response.json();
    console.log('MCP client registered successfully:', {
      clientId: client.client_id,
      clientSecret: client.client_secret ? '***' : 'Not provided',
      scopes: client.scope,
      tenantId: client.tenant_id
    });

    return client;
  } catch (error) {
    console.error('Error registering MCP client:', error);
    throw error;
  }
}

/**
 * Example 3: Complete MCP client setup flow
 */
async function setupMcpClient(userToken: string, clientName: string) {
  try {
    console.log('Step 1: Getting Initial Access Token...');
    const iatData = await getInitialAccessToken(userToken);

    console.log('Step 2: Registering MCP client with auth server...');
    const client = await registerMcpClientWithIAT(iatData.initial_access_token, clientName);

    console.log('Step 3: Getting access token for MCP operations...');
    const tokenResponse = await fetch(`${AUTH_ISSUER}/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${client.client_id}:${client.client_secret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'mcp:read mcp:write mcp:invoke',
        resource: 'https://mcp.example.com'
      })
    });

    if (!tokenResponse.ok) {
      throw new Error(`Token request failed: ${tokenResponse.status} ${tokenResponse.statusText}`);
    }

    const tokenData = await tokenResponse.json();
    console.log('Access token obtained:', {
      tokenType: tokenData.token_type,
      expiresIn: tokenData.expires_in,
      scopes: tokenData.scope
    });

    return {
      client,
      accessToken: tokenData.access_token
    };
  } catch (error) {
    console.error('Error in MCP client setup:', error);
    throw error;
  }
}

/**
 * Example 4: Validate IAT token
 */
async function validateIAT(iat: string) {
  try {
    const response = await fetch(`${AUTH_ISSUER}/oauth/validate-iat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${iat}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`IAT validation failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('IAT validation result:', {
      valid: data.valid,
      tenantId: data.claims?.tid,
      userId: data.claims?.uid,
      scopes: data.claims?.scopes,
      expiresIn: data.expires_in
    });

    return data;
  } catch (error) {
    console.error('Error validating IAT:', error);
    throw error;
  }
}

// Example usage
if (require.main === module) {
  const userToken = process.env.USER_TOKEN || 'your-user-jwt-token-here';
  const clientName = process.env.CLIENT_NAME || 'My MCP Client';

  console.log('=== MCP Client Setup with IAT ===\n');

  setupMcpClient(userToken, clientName)
    .then(({ client, accessToken }) => {
      console.log('\n✅ MCP client setup completed successfully!');
      console.log('Client ID:', client.client_id);
      console.log('Access Token:', accessToken.substring(0, 20) + '...');
    })
    .catch((error) => {
      console.error('\n❌ MCP client setup failed:', error.message);
      process.exit(1);
    });
}

export {
  getInitialAccessToken,
  registerMcpClientWithIAT,
  setupMcpClient,
  validateIAT
};
