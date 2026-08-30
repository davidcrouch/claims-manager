/**
 * Windows + Docker: Node often resolves `localhost` to `::1` first, while
 * Postgres is published on IPv4 only. That hangs ~30s then `read ECONNRESET`.
 */
export function rewriteLocalhostToIpv4(connectionUrl: string): string {
  return connectionUrl.replace(/@localhost(?=[:/?]|$)/gi, '@127.0.0.1');
}

export function rewriteLocalhostHost(host: string): string {
  return host.toLowerCase() === 'localhost' ? '127.0.0.1' : host;
}
