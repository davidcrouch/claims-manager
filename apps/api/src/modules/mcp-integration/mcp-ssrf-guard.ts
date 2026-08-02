import { BadRequestException, Logger } from '@nestjs/common';
import { resolve4, resolve6 } from 'node:dns/promises';

const logger = new Logger('McpSsrfGuard');

function isPrivateIPv4(ip: string): boolean {
  if (
    ip.startsWith('10.') ||
    ip.startsWith('127.') ||
    ip.startsWith('169.254.') ||
    ip.startsWith('192.168.')
  ) {
    return true;
  }
  if (ip.startsWith('172.')) {
    const parts = ip.split('.');
    const second = parseInt(parts[1], 10);
    if (second >= 16 && second <= 31) return true;
  }
  return ip === '0.0.0.0';
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  return (
    lower === '::1' ||
    lower.startsWith('fc') ||
    lower.startsWith('fd') ||
    lower.startsWith('fe80')
  );
}

function isPrivateIP(ip: string): boolean {
  return isPrivateIPv4(ip) || isPrivateIPv6(ip);
}

export async function validateMcpUrl(
  url: string,
  opts?: { allowLocalhost?: boolean },
): Promise<void> {
  const allowLocalhost =
    opts?.allowLocalhost ?? process.env.NODE_ENV !== 'production';

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new BadRequestException('Invalid MCP URL format');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new BadRequestException('Only HTTP(S) schemes are allowed');
  }

  if (parsed.protocol === 'http:' && !allowLocalhost) {
    throw new BadRequestException(
      'HTTP is only allowed for localhost in non-production',
    );
  }

  const hostname = parsed.hostname;

  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1'
  ) {
    if (!allowLocalhost) {
      throw new BadRequestException('Localhost not allowed in production');
    }
    return;
  }

  try {
    const ips = await resolveDns(hostname);
    for (const ip of ips) {
      if (isPrivateIP(ip)) {
        throw new BadRequestException('URL resolves to private IP range');
      }
    }
  } catch (err) {
    if (err instanceof BadRequestException) throw err;
    logger.warn(
      '[McpSsrfGuard.validateMcpUrl] DNS resolution failed during URL validation',
      { hostname, error: String(err) },
    );
    throw new BadRequestException('Unable to resolve hostname');
  }
}

export async function resolveDns(hostname: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const ipv4 = await resolve4(hostname);
    results.push(...ipv4);
  } catch {
    /* no A records */
  }
  try {
    const ipv6 = await resolve6(hostname);
    results.push(...ipv6);
  } catch {
    /* no AAAA records */
  }
  return results;
}

export async function validateResolvedIp(hostname: string): Promise<void> {
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1'
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException('Localhost blocked in production');
    }
    return;
  }

  const ips = await resolveDns(hostname);
  for (const ip of ips) {
    if (isPrivateIP(ip)) {
      throw new BadRequestException(
        'DNS rebinding detected — hostname resolves to private IP',
      );
    }
  }
}
