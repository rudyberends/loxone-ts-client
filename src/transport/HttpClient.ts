import { LoxoneConnectionError, LoxoneProtocolError } from '../errors.js';
import { TextMessage } from '../protocol/messages/TextMessage.js';

/** A `fetch`-compatible function, so consumers can inject a custom implementation. */
export type FetchLike = typeof fetch;

/** Information returned by the unauthenticated `jdev/cfg/apiKey` reachability check. */
export interface MiniserverApiInfo {
  /** Serial number / MAC address of the Miniserver. */
  serialNumber: string;
  /** Firmware version, e.g. `"14.5.12.6"`. */
  version: string;
  /**
   * TLS capability: `1` = TLS available, `2` = certificate present but expired,
   * `0`/absent = no TLS. Present only on new-generation Miniservers.
   */
  httpsStatus: number | undefined;
  /** Whether the Miniserver considers this connection "local" (since 12.1). */
  local: boolean | undefined;
  /** Whether live-update event slots are available (since the `hasEventSlots` attribute). */
  hasEventSlots: boolean | undefined;
  /** The raw parsed attributes, for fields not surfaced above. */
  raw: Record<string, unknown>;
}

/**
 * Thin HTTP(S) client for the unauthenticated/bootstrap requests that must happen
 * before (or alongside) the WebSocket: the `apiKey` reachability check and the
 * certificate/public-key fetch. All other traffic goes over the WebSocket.
 */
export class HttpClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;

  constructor(host: string, useTls: boolean, fetchImpl?: FetchLike) {
    const protocol = useTls ? 'https' : 'http';
    this.baseUrl = `${protocol}://${host}`;
    this.fetchImpl = fetchImpl ?? fetch;
  }

  /** Performs a GET and returns the raw response text. */
  async getText(path: string): Promise<{ status: number; text: string }> {
    const url = `${this.baseUrl}/${stripLeadingSlash(path)}`;
    let response: Response;
    try {
      response = await this.fetchImpl(url);
    } catch (cause) {
      throw new LoxoneConnectionError(`HTTP request to ${path} failed`, { cause });
    }
    return { status: response.status, text: await response.text() };
  }

  /** Performs a GET and parses the response as a {@link TextMessage} (LL envelope). */
  async getEnvelope(path: string): Promise<TextMessage> {
    const { status, text } = await this.getText(path);
    if (status === 503) {
      throw new LoxoneConnectionError('Miniserver is restarting (503)');
    }
    if (status >= 400) {
      throw new LoxoneConnectionError(`HTTP ${status} for ${path}`);
    }
    return new TextMessage(text);
  }

  /**
   * Fetches `jdev/cfg/apiKey` and parses it into {@link MiniserverApiInfo}.
   * This request transfers no confidential data and requires no authentication.
   */
  async getApiInfo(): Promise<MiniserverApiInfo> {
    const message = await this.getEnvelope('jdev/cfg/apiKey');
    const attrs = parseApiKeyValue(message.value);
    return {
      serialNumber: String(attrs.snr ?? ''),
      version: String(attrs.version ?? ''),
      httpsStatus: toNumber(attrs.httpsStatus),
      local: toBoolean(attrs.local),
      hasEventSlots: toBoolean(attrs.hasEventSlots),
      raw: attrs,
    };
  }

  /** Fetches the Miniserver certificate chain via `jdev/sys/getcertificate`. */
  async getCertificate(): Promise<string> {
    const { text } = await this.getText('jdev/sys/getcertificate');
    return text;
  }
}

function stripLeadingSlash(path: string): string {
  return path.startsWith('/') ? path.slice(1) : path;
}

/**
 * The `apiKey` value is a JSON-like string that (on most firmwares) uses single
 * quotes, e.g. `{'snr':'504F...','version':'14.5','httpsStatus':1}`. Newer
 * firmwares may already return a proper object. Handle both.
 */
function parseApiKeyValue(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    const normalized = value.replace(/'/g, '"');
    try {
      return JSON.parse(normalized) as Record<string, unknown>;
    } catch (cause) {
      throw new LoxoneProtocolError('Could not parse apiKey response value', { cause });
    }
  }
  throw new LoxoneProtocolError('Unexpected apiKey response value');
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}

function toBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true' || value === '1';
  if (typeof value === 'number') return value !== 0;
  return undefined;
}
