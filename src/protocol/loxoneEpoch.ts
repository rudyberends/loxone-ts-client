/** Loxone counts time in seconds since 2009-01-01 00:00:00 UTC. */
export const LOXONE_EPOCH_MS = Date.UTC(2009, 0, 1, 0, 0, 0);

/** Converts a Loxone timestamp (seconds since 2009-01-01 UTC) to a JS `Date`. */
export function loxoneEpochToDate(seconds: number): Date {
  return new Date(LOXONE_EPOCH_MS + seconds * 1000);
}
