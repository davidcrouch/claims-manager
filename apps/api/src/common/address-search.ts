import { sql, type SQL } from 'drizzle-orm';
import type { AnyColumn } from 'drizzle-orm';

type AddressColumns = {
  address: AnyColumn;
  suburb: AnyColumn;
  state: AnyColumn;
  postcode: AnyColumn;
  country: AnyColumn;
};

/** Human-readable address line for partial list search (not JSON serialization). */
export function addressSearchText(cols: AddressColumns): SQL {
  const { address, suburb, state, postcode, country } = cols;
  return sql`trim(concat_ws(' ',
    NULLIF(${address}->>'unitNumber', ''),
    NULLIF(${address}->>'unit_number', ''),
    NULLIF(${address}->>'streetNumber', ''),
    NULLIF(${address}->>'street_number', ''),
    NULLIF(${address}->>'streetName', ''),
    NULLIF(${address}->>'street_name', ''),
    NULLIF(${address}->>'suburb', ''),
    NULLIF(${address}->>'state', ''),
    NULLIF(${address}->>'postcode', ''),
    NULLIF(${address}->>'postCode', ''),
    NULLIF(${address}->>'country', ''),
    COALESCE(${suburb}, ''),
    COALESCE(${state}, ''),
    COALESCE(${postcode}, ''),
    COALESCE(${country}, '')
  ))`;
}

/** Strip LIKE wildcards so user input is treated as a literal substring. */
export function escapeIlikeToken(value: string): string {
  return value.replace(/[%_\\]/g, '');
}

export function parseSearchTokens(search: string | undefined): string[] {
  return (search ?? '')
    .trim()
    .split(/\s+/)
    .map((token) => escapeIlikeToken(token))
    .filter((token) => token.length > 0);
}
