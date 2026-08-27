import { forgetStaleSessionAccount, type OidcSessionLike } from '../../../config/oidc-provider.js';

describe('forgetStaleSessionAccount', () => {
   const accountId = '6afc0d80-fe9f-49c9-a0c3-ec02b50d9a48';

   function session(overrides: Partial<OidcSessionLike> = {}): OidcSessionLike {
      return {
         accountId,
         loginTs: 1_787_797_952,
         amr: ['pwd'],
         acr: '1',
         authorizations: { 'claims-manager-ui': { grantId: 'g1' } },
         ...overrides,
      };
   }

   it('clears identity so the login prompt can run', () => {
      const s = session();

      expect(forgetStaleSessionAccount(s, accountId)).toBe(true);
      expect(s.accountId).toBeUndefined();
      expect(s.loginTs).toBeUndefined();
      expect(s.amr).toBeUndefined();
      expect(s.acr).toBeUndefined();
      expect(s.authorizations).toBeUndefined();
      expect(s.touched).toBe(true);
   });

   it('does not touch a session for a different account', () => {
      const s = session();

      expect(forgetStaleSessionAccount(s, 'other-user')).toBe(false);
      expect(s.accountId).toBe(accountId);
      expect(s.authorizations).toEqual({ 'claims-manager-ui': { grantId: 'g1' } });
      expect(s.touched).toBeUndefined();
   });

   it('skips destroyed or missing sessions', () => {
      expect(forgetStaleSessionAccount(undefined, accountId)).toBe(false);
      expect(forgetStaleSessionAccount(null, accountId)).toBe(false);
      expect(forgetStaleSessionAccount(session({ destroyed: true }), accountId)).toBe(false);
   });
});
