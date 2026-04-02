/**
 * =============================================================================
 * CUSTOM SELECT_ORGANIZATION PROMPT
 * =============================================================================
 * 
 * Custom interaction prompt for organization selection during registration.
 * This allows existing users who belong to multiple organizations to select
 * which one to use (or create a new organization).
 * 
 * This prompt integrates with the OIDC policy system and triggers DURING registration
 * when the registration result indicates the user has multiple organizations.
 * 
 * Flow:
 * 1. User submits registration form
 * 2. System finds existing user by email
 * 3. If user has multiple organizations, registration result includes:
 *    - organizations: array of organization info
 *    - requiresOrganizationSelection: true
 * 4. Policy re-evaluates, select_organization checks detect this
 * 5. select_organization interaction is triggered
 * 6. User selects an organization (or creates new)
 * 7. select_organization is completed, flow continues to login
 * 
 * Usage: 
 * - Auto-trigger: During registration when existing user has multiple organizations
 * - Explicit: /authorize?prompt=select_organization&... (e.g., to switch organization)
 * 
 * Policy Order: Should come AFTER register, BEFORE login
 */

import { interactionPolicy } from 'oidc-provider';
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';

const baseLogger = createLogger('auth-server:select-organization-prompt', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'select-organization-prompt', 'SelectOrganizationPrompt', 'auth-server');

const { Prompt, Check } = interactionPolicy;

/**
 * Organization info structure from registration result
 */
export interface OrganizationInfo {
   organizationId: string;
   organizationName: string;
   role?: string;
}

/**
 * Creates a select_organization prompt instance.
 * 
 * The prompt is "requestable" which means it can be explicitly requested via prompt=select_organization.
 * It also auto-triggers when the registration result indicates multiple organizations.
 */
export default function selectOrganization() {
   return new Prompt(
      { name: 'select_organization', requestable: true },

      (ctx) => {
         const { oidc } = ctx;
         
         const registerResult = oidc.result?.register;
         const organizations = registerResult?.organizations || [];
         const email = registerResult?.email || '';
         const name = registerResult?.name || '';
         const userId = registerResult?.userId;
         
         log.debug({
            userId,
            organizationCount: organizations.length,
            hasRegisterResult: !!registerResult
         }, 'auth-server:select-organization-prompt:details - Providing interaction details');

         return {
            organizations,
            email,
            name,
            userId,
         };
      },

      new Check(
         'select_organization_prompt',
         'Organization selection was requested',
         'interaction_required',
         (ctx) => {
            const { oidc } = ctx;
            
            if (oidc.prompts.has('select_organization') && oidc.promptPending('select_organization')) {
               log.debug({ 
                  userId: oidc.result?.register?.userId 
               }, 'auth-server:select-organization-prompt:select_organization_prompt - Explicit select_organization prompt requested');
               return Check.REQUEST_PROMPT;
            }

            return Check.NO_NEED_TO_PROMPT;
         }
      ),

      new Check(
         'multiple_organizations_from_register',
         'User belongs to multiple organizations and must select one',
         'interaction_required',
         (ctx) => {
            const { oidc } = ctx;

            if (oidc.prompts.has('select_organization')) {
               return Check.NO_NEED_TO_PROMPT;
            }

            const registerResult = oidc.result?.register;
            
            if (!registerResult) {
               log.debug({}, 'auth-server:select-organization-prompt:multiple_organizations_from_register - No register result, skipping');
               return Check.NO_NEED_TO_PROMPT;
            }

            const requiresOrganizationSelection = registerResult.requiresOrganizationSelection === true;
            const organizations = registerResult.organizations;
            const hasMultipleOrganizations = Array.isArray(organizations) && organizations.length > 1;

            const selectOrganizationResult = oidc.result?.select_organization;
            const organizationAlreadySelected = selectOrganizationResult?.organizationId || selectOrganizationResult?.createNew === true;

            if (organizationAlreadySelected) {
               log.debug({
                  userId: registerResult.userId,
                  selectedOrganizationId: selectOrganizationResult?.organizationId,
                  createNew: selectOrganizationResult?.createNew
               }, 'auth-server:select-organization-prompt:multiple_organizations_from_register - Organization already selected');
               return Check.NO_NEED_TO_PROMPT;
            }

            if (requiresOrganizationSelection && hasMultipleOrganizations) {
               log.info({
                  userId: registerResult.userId,
                  organizationCount: organizations.length,
                  requiresOrganizationSelection
               }, 'auth-server:select-organization-prompt:multiple_organizations_from_register - Multiple organizations, organization selection required');
               return Check.REQUEST_PROMPT;
            }

            log.debug({
               userId: registerResult.userId,
               requiresOrganizationSelection,
               hasMultipleOrganizations,
               organizationCount: organizations?.length || 0
            }, 'auth-server:select-organization-prompt:multiple_organizations_from_register - No organization selection needed');
            
            return Check.NO_NEED_TO_PROMPT;
         }
      )
   );
}
