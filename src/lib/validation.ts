/**
 * True when `value` is a string with at least one non-whitespace character.
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * True when `value` is a finite number. `Number.isFinite` (unlike the global `isFinite`) never
 * coerces its argument, so it already rejects non-numbers on its own — this only adds the type
 * predicate TypeScript needs to narrow `value` at call sites.
 */
export function isFiniteNumber(value: unknown): value is number {
  return Number.isFinite(value);
}
