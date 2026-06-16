import { LoxoneProtocolError } from '../../errors.js';
import { isKnownMessageType, MessageType } from './MessageType.js';

/**
 * The 8-byte binary message header that precedes every payload on the WebSocket.
 *
 * ```
 * typedef struct {
 *   BYTE cBinType;     // fix 0x03
 *   BYTE cIdentifier;  // MessageType
 *   BYTE cInfo;        // info flags (bit 0 = "estimated length")
 *   BYTE cReserved;    // reserved
 *   UINT nLen;         // 32-bit LE payload length
 * } PACKED WsBinHdr;
 * ```
 */
export class MessageHeader {
  /** Size of the header on the wire, in bytes. */
  static readonly BYTE_LENGTH = 8;
  private static readonly MAGIC = 0x03;
  private static readonly INFO_ESTIMATED = 0x80;

  private constructor(
    /** The kind of payload that follows this header. */
    readonly messageType: MessageType,
    /** Length of the following payload in bytes (may be an estimate; see {@link estimated}). */
    readonly payloadLength: number,
    /**
     * Whether `payloadLength` is only an estimate. An estimated header is always
     * followed by an exact header before the real payload.
     */
    readonly estimated: boolean,
  ) {}

  /** Parses a header from the first 8 bytes of `buffer` at `offset`. */
  static parse(buffer: Buffer, offset = 0): MessageHeader {
    if (buffer.length < offset + MessageHeader.BYTE_LENGTH) {
      throw new LoxoneProtocolError('Buffer too small to read a message header');
    }
    const magic = buffer.readUInt8(offset);
    if (magic !== MessageHeader.MAGIC) {
      throw new LoxoneProtocolError(`Invalid message header magic byte: 0x${magic.toString(16)}`);
    }
    const identifier = buffer.readUInt8(offset + 1);
    if (!isKnownMessageType(identifier)) {
      throw new LoxoneProtocolError(`Unknown message header identifier: ${identifier}`);
    }
    const info = buffer.readUInt8(offset + 2);
    const length = buffer.readUInt32LE(offset + 4);
    return new MessageHeader(identifier, length, (info & MessageHeader.INFO_ESTIMATED) !== 0);
  }

  /** True for headers that are not followed by any payload (keepalive, out-of-service). */
  get hasPayload(): boolean {
    return this.messageType !== MessageType.Keepalive && this.messageType !== MessageType.OutOfService;
  }

  toString(): string {
    return `MessageHeader(${MessageType[this.messageType]}, ${this.payloadLength} bytes${this.estimated ? ', estimated' : ''})`;
  }
}
