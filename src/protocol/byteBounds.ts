import { LoxoneProtocolError } from '../errors.js';

/**
 * Guards a binary read against a too-short (truncated) or malformed buffer.
 * Throws a typed {@link LoxoneProtocolError} — rather than a raw `RangeError`
 * from `Buffer.read*` — when `need` bytes can't be read at `offset`. A negative
 * `need` (e.g. a corrupt, negative entry count read from the wire) is rejected
 * too, so callers can validate a count and its span in one call.
 */
export function ensureReadable(buffer: Buffer, offset: number, need: number, what: string): void {
  if (!Number.isInteger(need) || need < 0) {
    throw new LoxoneProtocolError(`Corrupt ${what}: invalid byte count ${need}`);
  }
  if (offset < 0 || offset + need > buffer.length) {
    throw new LoxoneProtocolError(
      `Truncated ${what}: need ${need} byte(s) at offset ${offset}, buffer has ${buffer.length}`,
    );
  }
}
