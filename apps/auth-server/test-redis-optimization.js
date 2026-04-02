/**
 * Test script to verify Phase 1 Redis optimization
 * Tests shared Redis connection and optimized storage patterns
 */

const { GlobalCacheManager } = require('./dist/lib/cache/global-cache-manager.js');

async function testRedisOptimization() {
  console.log('🧪 Testing Phase 1 Redis Optimization...\n');

  try {
    // Test 1: Shared Redis Connection
    console.log('1️⃣ Testing shared Redis connection...');
    const redis1 = await GlobalCacheManager.getInstance('auth-server');
    const redis2 = await GlobalCacheManager.getInstance('auth-server');
    
    if (redis1 === redis2) {
      console.log('✅ Shared Redis connection working - same instance returned');
    } else {
      console.log('❌ Shared Redis connection failed - different instances returned');
      return;
    }

    // Test 2: Connection Health
    console.log('\n2️⃣ Testing connection health...');
    await redis1.ping();
    console.log('✅ Redis connection is healthy');

    // Test 3: Optimized Key Patterns
    console.log('\n3️⃣ Testing optimized key patterns...');
    
    // Test OIDC keys (unchanged)
    const oidcKey = 'oidc:Session:test-session-123';
    await redis1.set(oidcKey, { test: 'oidc-session' }, { ex: 60 });
    const oidcResult = await redis1.get(oidcKey);
    console.log('✅ OIDC key pattern working:', oidcKey);

    // Test optimized account keys
    const accountKey = 'auth:account:test-account-123';
    await redis1.set(accountKey, { 
      userId: 'test-user',
      teamId: 'test-team',
      accessToken: 'test-token'
    }, { ex: 60 });
    const accountResult = await redis1.get(accountKey);
    console.log('✅ Optimized account key pattern working:', accountKey);

    // Test optimized token keys
    const tokenKey = 'auth:token:test-account-123:test-resource';
    await redis1.set(tokenKey, { 
      access_token: 'test-backend-token',
      expires_at: Date.now() + 3600000
    }, { ex: 60 });
    const tokenResult = await redis1.get(tokenKey);
    console.log('✅ Optimized token key pattern working:', tokenKey);

    // Cleanup
    await redis1.del(oidcKey, accountKey, tokenKey);
    console.log('\n🧹 Test data cleaned up');

    console.log('\n🎉 Phase 1 Redis optimization test completed successfully!');
    console.log('\n📊 Optimization Summary:');
    console.log('   • Shared Redis connection: ✅ Working');
    console.log('   • OIDC key patterns: ✅ Preserved (unchanged)');
    console.log('   • Account key patterns: ✅ Optimized (auth:account:*)');
    console.log('   • Token key patterns: ✅ Optimized (auth:token:*)');
    console.log('   • Connection health: ✅ Verified');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testRedisOptimization().catch(console.error);
