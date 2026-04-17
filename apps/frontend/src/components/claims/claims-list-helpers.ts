export const DEFAULT_CLAIMS_SORT = 'updated_at_desc';

const ALLOWED_SORT = new Set([
  'updated_at_desc',
  'updated_at_asc',
  'created_at_desc',
  'created_at_asc',
  'claim_number_asc',
  'claim_number_desc',
]);

export function normalizeSortParam(param: string | null): string {
  return param && ALLOWED_SORT.has(param) ? param : DEFAULT_CLAIMS_SORT;
}

export function buildClaimsListFetchKeyFromPageParams(params: {
  search?: string;
  sort?: string;
  status?: string;
}): string {
  const sort = normalizeSortParam(params.sort ?? null);
  const statusSorted = params.status
    ? params.status
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
        .sort()
        .join(',')
    : '';
  return `${params.search ?? ''}|${sort}|${statusSorted}`;
}
