/**
 * =============================================================================
 * CUSTOM REGISTER PROMPT
 * =============================================================================
 * 
 * Custom interaction prompt for user registration flow.
 * This allows using `prompt=register` in the authorization request to
 * directly trigger the registration flow instead of login.
 * 
 * Usage: /authorize?prompt=register&client_id=...&redirect_uri=...
 * 
 * The prompt will always request interaction (show registration page) when:
 * - No session exists, OR
 * - The `prompt=register` parameter is explicitly set
 */

import { interactionPolicy } from 'oidc-provider';

const { Prompt, Check } = interactionPolicy;

/**
 * Creates a register prompt instance.
 * 
 * The prompt is "requestable" which means:
 * - It can be explicitly requested via `prompt=register` in the authorize URL
 * - When requested, it will trigger an interaction even if user is logged in
 */
export default function register() {
   return new Prompt(
      { name: 'register', requestable: true },

      // Details function - provides context to the interaction
      (ctx) => {
         const { oidc } = ctx;
         return {
            // Pass through any hints that might be useful for registration
            ...(oidc.params.login_hint === undefined
               ? undefined
               : { login_hint: oidc.params.login_hint }),
         };
      },

      // Check: Always prompt for registration when explicitly requested
      // This is the primary check - if prompt=register is in the URL, show registration
      new Check(
         'registration_requested',
         'User registration is required',
         'interaction_required',
         (ctx) => {
            const { oidc } = ctx;
            
            // If login has been completed, user has finished the full flow - don't re-prompt register
            // This happens after: register → login prompt → login submission
            // The login result exists but session isn't created until tokens are issued
            if (oidc.result?.login?.accountId) {
               return Check.NO_NEED_TO_PROMPT;
            }
            
            // If prompt=register was explicitly requested and not yet resolved
            if (oidc.prompts.has('register') && oidc.promptPending('register')) {
               return Check.REQUEST_PROMPT;
            }

            return Check.NO_NEED_TO_PROMPT;
         }
      ),

      // Check: If no session and register is requested AND not yet resolved, prompt
      // Important: Must check promptPending to avoid infinite loop after registration
      new Check(
         'no_session_register',
         'User must register to continue',
         'interaction_required',
         (ctx) => {
            const { oidc } = ctx;
            
            // Only apply this check if register prompt was requested
            if (!oidc.prompts.has('register')) {
               return Check.NO_NEED_TO_PROMPT;
            }

            // If register prompt is already resolved, don't prompt again
            // This prevents infinite loop - after registration, login prompt takes over
            if (!oidc.promptPending('register')) {
               return Check.NO_NEED_TO_PROMPT;
            }
            
            // If login has been completed, user has finished the full flow - don't re-prompt
            if (oidc.result?.login?.accountId) {
               return Check.NO_NEED_TO_PROMPT;
            }

            // If no session and register still pending, require registration
            if (!oidc.session.accountId) {
               return Check.REQUEST_PROMPT;
            }

            return Check.NO_NEED_TO_PROMPT;
         }
      )
   );
}

