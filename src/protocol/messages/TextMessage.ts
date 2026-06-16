import { LoxoneCommandError } from '../../errors.js';

/** The `LL` response envelope used by the Miniserver for command responses. */
interface LoxoneEnvelope {
  control?: string;
  value?: unknown;
  // The Miniserver is inconsistent about casing: both `Code` and `code` occur.
  Code?: string | number;
  code?: string | number;
}

/**
 * A parsed text message received from the Miniserver.
 *
 * Most command responses are JSON wrapped in an `{ "LL": { ... } }` envelope.
 * Some payloads (e.g. SVG icons) are plain text. This class normalises both and
 * exposes the response `control`, numeric `code`, and `value` (as `unknown`,
 * with typed accessors).
 */
export class TextMessage {
  /** The control/command this response is for, if it was an enveloped response. */
  readonly control: string | undefined;
  /** The numeric response code (HTTP-style), if present. */
  readonly code: number | undefined;
  /** The response value: a string for simple responses, an object for structured ones. */
  readonly value: unknown;
  /** The raw decoded text. */
  readonly raw: string;
  /** Whether the payload parsed as JSON. */
  readonly isJson: boolean;

  constructor(raw: string) {
    this.raw = raw;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
      this.isJson = true;
    } catch {
      this.isJson = false;
      this.value = raw;
      this.control = undefined;
      this.code = undefined;
      return;
    }

    const ll = extractEnvelope(parsed);
    if (ll) {
      this.control = typeof ll.control === 'string' ? ll.control : undefined;
      this.code = parseCode(ll.Code ?? ll.code);
      this.value = ll.value;
    } else {
      // Valid JSON but not an LL envelope (e.g. the structure file).
      this.value = parsed;
      this.control = undefined;
      this.code = undefined;
    }
  }

  /** True when the response code is 200. */
  get ok(): boolean {
    return this.code === 200;
  }

  /** Returns `value` as a string, or `undefined` if it is not a string. */
  asString(): string | undefined {
    return typeof this.value === 'string' ? this.value : undefined;
  }

  /** Returns `value` as a number, parsing numeric strings. */
  asNumber(): number | undefined {
    if (typeof this.value === 'number') return this.value;
    if (typeof this.value === 'string' && this.value.trim() !== '') {
      const n = Number(this.value);
      return Number.isNaN(n) ? undefined : n;
    }
    return undefined;
  }

  /**
   * Returns `value` as a structured record, narrowed to `T`. Returns `undefined`
   * if the value is not an object. The cast is unchecked — callers should only
   * use this for responses whose shape they know (e.g. token/getkey2).
   */
  asRecord<T = Record<string, unknown>>(): T | undefined {
    return typeof this.value === 'object' && this.value !== null ? (this.value as T) : undefined;
  }

  /**
   * Returns `value` as a parsed JSON value of type `T`. Some endpoints
   * double-encode an array/object into the `value` field as a JSON string
   * (e.g. `gethistory`, `getStatisticInfo`); when so, it is parsed. Otherwise the
   * value is returned as-is. Returns `undefined` only when there is no value.
   */
  jsonValue<T = unknown>(): T | undefined {
    const value = this.value;
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    }
    return value as T;
  }

  /** Throws a {@link LoxoneCommandError} unless the response code is 200. */
  ensureOk(command?: string): this {
    if (!this.ok) {
      const cmd = command ?? this.control;
      throw new LoxoneCommandError(`Command failed with code ${this.code}`, {
        ...(this.code !== undefined ? { code: this.code } : {}),
        ...(cmd !== undefined ? { command: cmd } : {}),
      });
    }
    return this;
  }

  toString(): string {
    if (!this.isJson) return this.raw;
    return `code=${this.code ?? '-'} control=${this.control ?? '-'} value=${stringifyValue(this.value)}`;
  }
}

function extractEnvelope(parsed: unknown): LoxoneEnvelope | undefined {
  if (typeof parsed === 'object' && parsed !== null && 'LL' in parsed) {
    const ll = (parsed as { LL: unknown }).LL;
    if (typeof ll === 'object' && ll !== null) return ll as LoxoneEnvelope;
  }
  return undefined;
}

function parseCode(code: string | number | undefined): number | undefined {
  if (code === undefined) return undefined;
  const n = typeof code === 'number' ? code : parseInt(code, 10);
  return Number.isNaN(n) ? undefined : n;
}

function stringifyValue(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
