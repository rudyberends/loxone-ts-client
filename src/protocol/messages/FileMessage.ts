/**
 * A file received from the Miniserver (e.g. `data/LoxAPP3.json`, icons, statistics).
 *
 * Text files (JSON/XML/SVG) arrive as text messages; binary files (PNG, statistic
 * blobs) arrive as binary. This wrapper preserves whichever form was received and
 * offers typed accessors.
 */
export class FileMessage {
  /** The filename/command this file was requested with. */
  readonly filename: string;
  /** Whether the payload arrived as binary (vs. text). */
  readonly isBinary: boolean;
  /** The payload as a Buffer (always available). */
  readonly buffer: Buffer;

  constructor(filename: string, data: Buffer | string, isBinary: boolean) {
    this.filename = filename;
    this.isBinary = isBinary;
    this.buffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  }

  /** Size of the payload in bytes. */
  get length(): number {
    return this.buffer.byteLength;
  }

  /** The payload decoded as UTF-8 text. */
  text(): string {
    return this.buffer.toString('utf8');
  }

  /** The payload parsed as JSON, narrowed to `T`. */
  json<T = unknown>(): T {
    return JSON.parse(this.text()) as T;
  }

  toString(): string {
    return `FileMessage(${this.filename}, ${this.isBinary ? 'binary' : 'text'}, ${this.length} bytes)`;
  }
}
