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
 * Replace placeholders in a string:
 *   {country} → country value
 *   {random}  → random string (different each call)
 *   {stack}   → stacking random (appends new random each call)
 */
let stackRandom = '';

export function replacePlaceholders(
  text: string,
  country: string,
): string {
  if (!text) return text;
  let result = text;
  result = result.replace(/\{country\}/gi, country);
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
