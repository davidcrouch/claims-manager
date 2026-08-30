import { rewriteLocalhostHost, rewriteLocalhostToIpv4 } from './pg-url';

describe('pg-url', () => {
  it('database.config.rewriteLocalhostToIpv4 — maps localhost in URL to 127.0.0.1', () => {
    expect(
      rewriteLocalhostToIpv4(
        'postgresql://more0ai:password@localhost:3210/claims_manager',
      ),
    ).toBe('postgresql://more0ai:password@127.0.0.1:3210/claims_manager');
  });

  it('database.config.rewriteLocalhostHost — maps localhost host to 127.0.0.1', () => {
    expect(rewriteLocalhostHost('localhost')).toBe('127.0.0.1');
    expect(rewriteLocalhostHost('pgsql')).toBe('pgsql');
  });
});
