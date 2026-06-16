import { describe, expect, it } from 'vitest';
import { Uuid } from '../src/protocol/messages/Uuid.js';

describe('Uuid', () => {
  it('parses a binary UUID with the documented endian swaps', () => {
    const buffer = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    // Data1 (32-bit LE) and Data2/Data3 (16-bit LE) are byte-swapped; Data4 is as-is.
    expect(Uuid.fromBuffer(buffer).value).toBe('03020100-0504-0706-08090a0b0c0d0e0f');
  });

  it('round-trips buffer -> string -> buffer', () => {
    const buffer = Buffer.from([16, 32, 48, 64, 1, 2, 3, 4, 255, 254, 253, 252, 10, 20, 30, 40]);
    const uuid = Uuid.fromBuffer(buffer);
    expect([...uuid.toBuffer()]).toEqual([...buffer]);
  });

  it('parses the 4-segment Loxone string form', () => {
    const s = '0f869a02-0367-3105-ffffb2f8baf0a3e6';
    expect(Uuid.fromString(s).value).toBe(s);
  });

  it('rejects the 5-segment RFC form (the Miniserver never emits it)', () => {
    expect(() => Uuid.fromString('12345678-1234-1234-1234-1234567890ab')).toThrow();
  });

  it('exposes a zero EMPTY uuid', () => {
    expect(Uuid.EMPTY.value).toBe('00000000-0000-0000-0000000000000000');
  });

  it('compares by value', () => {
    const a = Uuid.fromString('0f869a02-0367-3105-ffffb2f8baf0a3e6');
    expect(a.equals('0f869a02-0367-3105-ffffb2f8baf0a3e6')).toBe(true);
    expect(a.equals(Uuid.EMPTY)).toBe(false);
  });

  it('rejects malformed strings', () => {
    expect(() => Uuid.fromString('nope')).toThrow();
    expect(() => Uuid.fromString('12-34-56-78')).toThrow();
  });
});
