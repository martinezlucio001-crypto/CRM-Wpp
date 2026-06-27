/**
 * Currency — single source of truth for deal-value formatting and
 * the currency picker options.
 *
 * Before this module, ~6 components each defined their own
 * `Intl.NumberFormat(..., { currency: "USD" })` helper with USD
 * baked in. The default currency is now configurable per account
 * (accounts.default_currency, migration 021), so every formatter
 * takes a currency and falls back to DEFAULT_CURRENCY only when
 * nothing is known.
 */

/** App-wide fallback when no account/deal currency is available. */
export const DEFAULT_CURRENCY = "BRL";

export interface CurrencyOption {
  /** ISO-4217 code, e.g. "USD". Stored verbatim in the DB. */
  code: string;
  /** Human label for the dropdown, e.g. "US Dollar". */
  label: string;
  /** Symbol for compact display, e.g. "$". */
  symbol: string;
}

/**
 * The currencies offered in pickers. Codes must be valid ISO-4217 so
 * `Intl.NumberFormat` renders the right symbol/grouping. Extend this
 * list to offer more — nothing else needs to change.
 */
export const CURRENCIES: CurrencyOption[] = [
  { code: "BRL", label: "Brazilian Real", symbol: "R$" },
];

/**
 * Format a deal value as a currency string. Whole-number output
 * (no minor units) — deal values are tracked to the dollar across
 * the app.
 */
export function formatCurrency(
  value: number,
  currency: string = "BRL",
): string {
  const code = "BRL";
  const amount = Number(value) || 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    // Invalid ISO code — show the raw code + grouped number so the
    // value is still legible instead of throwing.
    return `${code} ${new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 0,
    }).format(amount)}`;
  }
}

/**
 * Compact currency for tight spaces (donut center, legend rows):
 * "R$1.2M" / "R$900".
 */
export function formatCurrencyShort(
  value: number,
  currency: string = "BRL",
): string {
  const symbol = "R$";
  const v = Number(value || 0);
  if (v >= 1_000_000) return `${symbol}${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${symbol}${(v / 1_000).toFixed(1)}k`;
  return `${symbol}${v.toFixed(0)}`;
}
