/**
 * =============================================================================
 * CUSTOM SELECT_ORG PROMPT
 * =============================================================================
 * 
 * Custom interaction prompt for organization selection in multi-organization apps.
 * This allows users who belong to multiple organizations to select which one
 * they want to authenticate under.
 * 
 * This prompt integrates with the OIDC policy system and triggers AFTER login
 * when the login result indicates the user has multiple organizations.
 * 
 * Flow:
 * 1. User logs in successfully
 * 2. If user has multiple organizations, login result includes:
 *    - organizations: array of organization info
 *    - requiresOrgSelection: true
 * 3. Policy re-evaluates, select_org checks detect this
 * 4. select_org interaction is triggered
 * 5. User selects an organization
 * 6. select_org is completed, flow continues to consent
 * 
 * Usage: 
 * - Auto-trigger: After login when user has multiple orgs
 * - Explicit: /authorize?prompt=select_org&... (e.g., to switch orgs)
 * 
 * Policy Order: Should come AFTER login (user must be authenticated first)
 */

import { interactionPolicy } from 'oidc-provider';
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';

const baseLogger = createLogger('auth-server:select-org-prompt', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'select-org-prompt', 'SelectOrgPrompt', 'auth-server');

const { Prompt, Check } = interactionPolicy;

/**
 * Organization info structure from login result
 */
export interface OrganizationInfo {
   organizationId: string;
   organizationName: string;
   role?: string;
}

/**
 * Creates a select_org prompt instance.
 * 
 * The prompt is "requestable" which means it can be explicitly requested via prompt=select_org.
 * It also auto-triggers when the login result indicates multiple organizations.
 */
export default function selectOrg() {
   return new Prompt(
      { name: 'select_org', requestable: true },

      // Details function - provides context to the interaction
      // This data is available in the interaction details and passed to the select-org page
      (ctx) => {
         const { oidc } = ctx;
         
         // Get organizations from login result
         const loginResult = oidc.result?.login;
         const organizations = loginResult?.organizations || [];
         const email = loginResult?.email || '';
         const name = loginResult?.name || '';
         const sessionUserId = oidc.session?.accountId; // OIDC standard: accountId = userId
         
         log.debug({
            sessionUserId,
            organizationCount: organizations.length,
            hasLoginResult: !!loginResult
         }, 'auth-server:select-org-prompt:details - Providing interaction details');

         return {
            organizations,
            email,
            name,
            sessionUserId,
         };
      },

      // Check 1: Prompt when explicitly requested via prompt=select_org
      new Check(
         'select_org_prompt',
         'Organization selection was requested',
         'interaction_required',
         (ctx) => {
            const { oidc } = ctx;
            
            // If prompt=select_org was explicitly requested and not yet resolved
            if (oidc.prompts.has('select_org') && oidc.promptPending('select_org')) {
               log.debug({ 
                  sessionUserId: oidc.session?.accountId // OIDC standard: accountId = userId
               }, 'auth-server:select-org-prompt:select_org_prompt - Explicit select_org prompt requested');
               return Check.REQUEST_PROMPT;
            }

            return Check.NO_NEED_TO_PROMPT;
         }
      ),

      // Check 2: Auto-prompt when login result indicates multiple organizations
      new Check(
         'multiple_organizations_from_login',
         'User belongs to multiple organizations and must select one',
         'interaction_required',
         (ctx) => {
            const { oidc } = ctx;

            // Skip if select_org was explicitly requested (handled by first check)
            if (oidc.prompts.has('select_org')) {
               return Check.NO_NEED_TO_PROMPT;
            }

            // Check if login result indicates org selection is needed
            const loginResult = oidc.result?.login;
            
            if (!loginResult) {
               log.debug({}, 'auth-server:select-org-prompt:multiple_organizations_from_login - No login result, skipping');
               return Check.NO_NEED_TO_PROMPT;
            }

            // Check if org selection is required and not yet done
            const requiresOrgSelection = loginResult.requiresOrgSelection === true;
            const organizations = loginResult.organizations;
            const hasMultipleOrganizations = Array.isArray(organizations) && organizations.length > 1;

            // Check if org has already been selected (select_org result exists)
            const selectOrgResult = oidc.result?.select_org;
            const orgAlreadySelected = selectOrgResult?.organizationId;

            if (orgAlreadySelected) {
               log.debug({
                  sessionUserId: oidc.session?.accountId, // OIDC standard: accountId = userId
                  selectedOrganizationId: selectOrgResult?.organizationId
               }, 'auth-server:select-org-prompt:multiple_organizations_from_login - Org already selected');
               return Check.NO_NEED_TO_PROMPT;
            }

            if (requiresOrgSelection && hasMultipleOrganizations) {
               log.info({
                  sessionUserId: oidc.session?.accountId, // OIDC standard: accountId = userId
                  organizationCount: organizations.length,
                  requiresOrgSelection
               }, 'auth-server:select-org-prompt:multiple_organizations_from_login - Multiple organizations, org selection required');
               return Check.REQUEST_PROMPT;
            }

            log.debug({
               sessionUserId: oidc.session?.accountId, // OIDC standard: accountId = userId
               requiresOrgSelection,
               hasMultipleOrganizations,
               organizationCount: organizations?.length || 0
            }, 'auth-server:select-org-prompt:multiple_organizations_from_login - No org selection needed');
            
            return Check.NO_NEED_TO_PROMPT;
         }
      )
   );
}
