import { LoxoneProtocolError } from '../../errors.js';

/**
 * A Loxone UUID (128 bits).
 *
 * Binary layout on the wire (little-endian), per the protocol spec:
 * ```
 * typedef struct _UUID {
 *   unsigned long  Data1;     // 32-bit LE
 *   unsigned short Data2;     // 16-bit LE
 *   unsigned short Data3;     // 16-bit LE
 *   unsigned char  Data4[8];  // 8 bytes, as-is
 * } PACKED PUUID;
 * ```
 * The string form is `Data1-Data2-Data3-Data4` where Data1..3 are byte-swapped
 * from little-endian to big-endian for display, e.g.
 * `0f869a02-0367-3105-ffffb2f8baf0a3e6`.
 */
export class Uuid {
  /** Fixed size of a UUID on the wire, in bytes. */
  static readonly BYTE_LENGTH = 16;

  /** A canonical all-zero UUID, used for "not assigned" rooms/categories. */
  static readonly EMPTY: Uuid = Uuid.fromBuffer(Buffer.alloc(16), 0);

  private constructor(readonly value: string) {}

  /** Parses a UUID from a binary buffer at `offset`, swapping endianness for display. */
  static fromBuffer(buffer: Buffer, offset = 0): Uuid {
    if (buffer.length < offset + Uuid.BYTE_LENGTH) {
      throw new LoxoneProtocolError('Buffer too small to read a UUID');
    }
    const data1 = swap32(buffer.subarray(offset + 0, offset + 4));
    const data2 = swap16(buffer.subarray(offset + 4, offset + 6));
    const data3 = swap16(buffer.subarray(offset + 6, offset + 8));
    const data4 = Buffer.from(buffer.subarray(offset + 8, offset + 16));
    const value = `${data1.toString('hex')}-${data2.toString('hex')}-${data3.toString('hex')}-${data4.toString('hex')}`;
    return new Uuid(value);
  }

  /**
   * Parses a UUID from its Loxone 4-segment string form
   * (`xxxxxxxx-xxxx-xxxx-xxxxxxxxxxxxxxxx`) — the only form the Miniserver emits.
   */
  static fromString(uuid: string): Uuid {
    const [p0, p1, p2, p3, ...rest] = uuid.split('-');
    if (rest.length > 0 || p0?.length !== 8 || p1?.length !== 4 || p2?.length !== 4 || p3?.length !== 16) {
      throw new LoxoneProtocolError(`Invalid UUID string: ${uuid}`);
    }
    return new Uuid(`${p0}-${p1}-${p2}-${p3}`);
  }

  /** The canonical string form of this UUID. */
  toString(): string {
    return this.value;
  }

  /** Structural equality with another UUID or its string form. */
  equals(other: Uuid | string): boolean {
    return this.value === (typeof other === 'string' ? other : other.value);
  }

  /** Serializes this UUID back to its 16-byte little-endian wire form. */
  toBuffer(): Buffer {
    const [p0, p1, p2, p3] = this.value.split('-') as [string, string, string, string];
    const out = Buffer.concat([
      swap32(Buffer.from(p0, 'hex')),
      swap16(Buffer.from(p1, 'hex')),
      swap16(Buffer.from(p2, 'hex')),
      Buffer.from(p3, 'hex'),
    ]);
    return out;
  }
}

function swap16(input: Buffer): Buffer {
  const b = Buffer.from(input);
  const t = b[0]!;
  b[0] = b[1]!;
  b[1] = t;
  return b;
}

function swap32(input: Buffer): Buffer {
  const b = Buffer.from(input);
  let t = b[0]!;
  b[0] = b[3]!;
  b[3] = t;
  t = b[1]!;
  b[1] = b[2]!;
  b[2] = t;
  return b;
}
