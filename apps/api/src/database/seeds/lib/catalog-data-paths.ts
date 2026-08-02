import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Resolve repo `data/` directory whether cwd is apps/api or monorepo root.
 */
export function resolveRepoDataDir(): string {
  const candidates = [
    join(process.cwd(), 'data'),
    join(process.cwd(), '../../data'),
    join(process.cwd(), '../../../data'),
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, 'building-repairs-catalog.csv'))) return dir;
  }
  throw new Error(
    `[seeds/catalog-data-paths] cannot find data/building-repairs-catalog.csv from cwd=${process.cwd()}`,
  );
}

export function catalogCsvPath(): string {
  return join(resolveRepoDataDir(), 'building-repairs-catalog.csv');
}

export function assemblyBomPath(): string {
  return join(resolveRepoDataDir(), 'internal-assembly-bom.json');
}

export function templatesDir(): string {
  return join(resolveRepoDataDir(), 'templates');
}
