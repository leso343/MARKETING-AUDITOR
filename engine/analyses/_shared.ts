/**
 * Shared numeric helpers for engine analyses.
 *
 * Pulled out of the six analysis files that each had identical copies of
 * `round` and the two copies of `sum`. Behaviour is unchanged — these are
 * verbatim extractions, not rewrites.
 */

/** Round to N decimal places. */
export function round(n: number, d: number): number {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}

/** Sum a list of numbers, treating null/undefined as 0. */
export function sum(nums: Array<number | null | undefined>): number {
  return nums.reduce<number>((a, b) => a + (b ?? 0), 0);
}
