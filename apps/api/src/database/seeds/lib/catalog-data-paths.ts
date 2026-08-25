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

const IAG_CW_STABLE = 'iag-2026-04-35.csv';
const IAG_CW_SOURCE = 'IAG Catalog ItemsExport -2026-04-35.csv';
const IAG_ENSURE_STABLE = 'iag-ensure-scopes.import.csv';
const IAG_ENSURE_SOURCE =
  'IAG Catalog ItemsExport -2026-04-35 with ENSURE SCOPE ITEMS.import.csv';

function firstExisting(paths: string[], label: string): string {
  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  throw new Error(
    `[seeds/catalog-data-paths] cannot find ${label} from cwd=${process.cwd()} tried=${paths.join(' | ')}`,
  );
}

/** Full IAG / Crunchwork 2026-04-35 export (CSV `ID` = CW catalogue UUID). */
export function iagCrunchworkCatalogCsvPath(): string {
  const override = (process.env.IAG_CATALOG_CSV ?? '').trim();
  if (override && existsSync(override)) return override;
  const dataDir = resolveRepoDataDir();
  return firstExisting(
    [
      join(dataDir, 'catalogues', IAG_CW_STABLE),
      join(dataDir, 'catalogues', IAG_CW_SOURCE),
    ],
    'IAG Crunchwork catalogue CSV',
  );
}

/** Ensure-only scope rows imported into the default internal catalogue. */
export function iagEnsureScopesCsvPath(): string {
  const override = (process.env.IAG_ENSURE_SCOPES_CSV ?? '').trim();
  if (override && existsSync(override)) return override;
  const dataDir = resolveRepoDataDir();
  return firstExisting(
    [
      join(dataDir, 'catalogues', IAG_ENSURE_STABLE),
      join(dataDir, 'catalogues', IAG_ENSURE_SOURCE),
    ],
    'IAG Ensure scope catalogue CSV',
  );
}
