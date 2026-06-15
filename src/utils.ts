const PREFIX = 'ce-tiaozhuan:';

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

export function generateRandomStr(len = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < len; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

/**
 * Normalize country code aliases.
 * People often type "UK" but proxies use "GB" (ISO 3166-1 alpha-2).
 */
const COUNTRY_ALIASES: Record<string, string> = {
  UK: 'GB',
};

export function normalizeCountry(country: string): string {
  const upper = country.toUpperCase();
  return COUNTRY_ALIASES[upper] || upper;
}

/**
 * Replace placeholders in a string:
 *   {country} → country value (normalized, e.g. UK→GB)
 *   {rawcountry} → raw country value as-is (no normalization)
 *   {random}  → random string (different each call)
 *   {stack}   → stacking random (appends new random each call)
 */
let stackRandom = '';

export function replacePlaceholders(
  text: string,
  country: string,
): string {
  if (!text) return text;
  const normalized = normalizeCountry(country);
  let result = text;
  result = result.replace(/\{rawcountry\}/gi, country);
  result = result.replace(/\{country\}/gi, normalized);
  result = result.replace(/\{random\}/gi, () => generateRandomStr(8));
  result = result.replace(/\{stack\}/gi, () => {
    stackRandom += generateRandomStr(4);
    return stackRandom;
  });
  return result;
}

/** Reset stack random before each track run */
export function resetStackRandom(): void {
  stackRandom = '';
}
