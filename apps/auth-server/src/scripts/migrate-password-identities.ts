/**
 * Migration Script: Create Password Identity Records for Existing Users
 * 
 * This script creates user_identity records for existing users who have
 * password hashes set but don't have a corresponding identity record.
 * 
 * This is part of the Unified Identity Model implementation.
 * 
 * Usage:
 *   pnpm tsx apps/auth-server/src/scripts/migrate-password-identities.ts [--dry-run]
 * 
 * Options:
 *   --dry-run    Preview changes without actually creating records
 */

import { createLogger, LoggerType } from '../lib/logger.js';
import { getDb } from '../db/client.js';
import { createUsersRepository } from '../db/repositories/users-repository.js';
import { createUserIdentitiesRepository } from '../db/repositories/user-identities-repository.js';
import type { AccessContext } from '../schemas/index.js';

const log = createLogger('migration:password-identities', LoggerType.NODEJS);

// System context for migration operations
const MORE0_SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
const systemContext: AccessContext = { organizationId: 'public', userId: MORE0_SYSTEM_USER_ID };

interface MigrationResult {
   totalUsers: number;
   usersWithPassword: number;
   usersAlreadyMigrated: number;
   usersMigrated: number;
   errors: Array<{ userId: string; email: string; error: string }>;
}

async function migratePasswordIdentities(params: { dryRun: boolean }): Promise<MigrationResult> {
   const { dryRun } = params;
   
   log.info({ dryRun }, 'migration:password-identities - Starting migration');
   
   const usersRepo = createUsersRepository(getDb, undefined);
   const userIdentitiesRepo = createUserIdentitiesRepository(getDb, undefined);
   
   const result: MigrationResult = {
      totalUsers: 0,
      usersWithPassword: 0,
      usersAlreadyMigrated: 0,
      usersMigrated: 0,
      errors: []
   };
   
   try {
      // Get all users
      const usersResult = await usersRepo.list(systemContext, { limit: 10000 });
      result.totalUsers = usersResult.pagination.total;
      
      log.info({ totalUsers: result.totalUsers }, 'migration:password-identities - Found users');
      
      for (const user of usersResult.data) {
         const userId = (user as any).id;
         const email = user.email;
         const passwordHash = (user as any).passwordHash;
         
         // Skip users without password
         if (!passwordHash) {
            continue;
         }
         
         result.usersWithPassword++;
         
         try {
            // Check if user already has a password identity
            const existingIdentity = await userIdentitiesRepo.getByProviderAndProviderUserId(
               systemContext,
               'password',
               email
            );
            
            if (existingIdentity) {
               result.usersAlreadyMigrated++;
               log.debug({ userId, email }, 'migration:password-identities - User already has password identity, skipping');
               continue;
            }
            
            // Create password identity
            if (dryRun) {
               log.info({ userId, email }, 'migration:password-identities - [DRY RUN] Would create password identity');
               result.usersMigrated++;
            } else {
               await userIdentitiesRepo.create(systemContext, {
                  userId,
                  provider: 'password',
                  providerUserId: email,
                  displayName: user.name || email,
                  rawProfile: {
                     migratedAt: new Date().toISOString(),
                     migrationScript: 'migrate-password-identities',
                     originalUserId: userId
                  }
               });
               
               result.usersMigrated++;
               log.info({ userId, email }, 'migration:password-identities - Created password identity');
            }
         } catch (error: any) {
            log.error({ 
               userId, 
               email, 
               error: error.message 
            }, 'migration:password-identities - Failed to create identity');
            
            result.errors.push({
               userId,
               email,
               error: error.message
            });
         }
      }
      
      return result;
   } catch (error: any) {
      log.error({ error: error.message }, 'migration:password-identities - Migration failed');
      throw error;
   }
}

// Main execution
async function main() {
   const args = process.argv.slice(2);
   const dryRun = args.includes('--dry-run');
   
   console.log('='.repeat(60));
   console.log('Password Identity Migration Script');
   console.log('='.repeat(60));
   console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (changes will be made)'}`);
   console.log('');
   
   try {
      const result = await migratePasswordIdentities({ dryRun });
      
      console.log('');
      console.log('Migration Results:');
      console.log('-'.repeat(40));
      console.log(`Total users:              ${result.totalUsers}`);
      console.log(`Users with password:      ${result.usersWithPassword}`);
      console.log(`Already migrated:         ${result.usersAlreadyMigrated}`);
      console.log(`Newly migrated:           ${result.usersMigrated}`);
      console.log(`Errors:                   ${result.errors.length}`);
      
      if (result.errors.length > 0) {
         console.log('');
         console.log('Errors:');
         result.errors.forEach((err, i) => {
            console.log(`  ${i + 1}. User ${err.email}: ${err.error}`);
         });
      }
      
      console.log('');
      console.log(dryRun ? 'Dry run complete. No changes were made.' : 'Migration complete!');
      
      process.exit(result.errors.length > 0 ? 1 : 0);
   } catch (error: any) {
      console.error('Migration failed:', error.message);
      process.exit(1);
   }
}

main();

