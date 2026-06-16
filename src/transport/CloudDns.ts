import { LoxoneConnectionError } from '../errors.js';
import type { FetchLike } from './HttpClient.js';

/** Loxone Cloud DNS / Remote Connect endpoint. */
export const CLOUD_DNS_HOST = 'connect.loxonecloud.com';

/** Result of resolving a Miniserver's external address via Cloud DNS. */
export interface CloudDnsResult {
  /** Cloud DNS status code (200 = ok). */
  code: number;
  /** Plain `host:port` for WS/HTTP, when reported. */
  ipPort: string | undefined;
  /** Whether the reported port is open. */
  portOpen: boolean | undefined;
  /** `host:port` for WSS/HTTPS (TLS), when reported. */
  ipPortHttps: string | undefined;
  /** Whether the reported HTTPS port is open. */
  portOpenHttps: boolean | undefined;
  /** Time of the last IP update reported by the Miniserver. */
  lastUpdated: string | undefined;
  /** The raw parsed response. */
  raw: Record<string, unknown>;
}

/**
 * Resolves a Miniserver's current external address through the Loxone Cloud DNS
 * / Remote Connect service. Use this when you only know the Miniserver's serial
 * number and need to discover where it is currently reachable.
 *
 * Note: when connecting over TLS you must use a hostname (certificates are not
 * issued for IPs). Use {@link buildTlsHostname} to derive the CloudDNS hostname
 * from the resolved IP/port and serial number.
 */
export class CloudDns {
  private readonly base: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: { host?: string; fetchImpl?: FetchLike } = {}) {
    this.base = `https://${options.host ?? CLOUD_DNS_HOST}`;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /** Requests the current external IP/port for the given serial number. */
  async resolve(serialNumber: string): Promise<CloudDnsResult> {
    const url = `${this.base}/?getip&snr=${encodeURIComponent(serialNumber)}&json=true`;
    let response: Response;
    try {
      response = await this.fetchImpl(url);
    } catch (cause) {
      throw new LoxoneConnectionError('Cloud DNS request failed', { cause });
    }
    let raw: Record<string, unknown>;
    try {
      raw = (await response.json()) as Record<string, unknown>;
    } catch (cause) {
      throw new LoxoneConnectionError('Could not parse Cloud DNS response', { cause });
    }

    const code = Number(raw.Code ?? response.status);
    if (code !== 200) {
      throw new LoxoneConnectionError(`Cloud DNS returned code ${code} for ${serialNumber}`);
    }
    return {
      code,
      ipPort: asString(raw.IP),
      portOpen: raw.PortOpen === true || raw.PortOpen === 'true',
      ipPortHttps: asString(raw.IPHTTPS),
      portOpenHttps: raw.PortOpenHTTPS === true || raw.PortOpenHTTPS === 'true',
      lastUpdated: asString(raw.LastUpdated),
      raw,
    };
  }
}

/**
 * Builds the CloudDNS TLS hostname from an `ip:port` value and serial number, per
 * the protocol spec:
 * - IPv4: replace `.` with `-`
 * - IPv6: strip `[`/`]`, replace `:` with `-`
 * - hostname = `{cleaned-ip}.{snr}.dyndns.loxonecloud.com:{port}`
 *
 * Works for both external IPs (from {@link CloudDns.resolve}) and a local IP when
 * the Miniserver uses the CloudDNS certificate.
 */
export function buildTlsHostname(ipPort: string, serialNumber: string): string {
  const lastColon = ipPort.lastIndexOf(':');
  if (lastColon === -1) {
    throw new LoxoneConnectionError(`Expected "ip:port", got "${ipPort}"`);
  }
  const ip = ipPort.slice(0, lastColon);
  const port = ipPort.slice(lastColon + 1);
  const cleaned = ip.includes(':')
    ? ip.replace(/^\[/, '').replace(/\]$/, '').replace(/:/g, '-') // IPv6
    : ip.replace(/\./g, '-'); // IPv4
  return `${cleaned}.${serialNumber}.dyndns.loxonecloud.com:${port}`;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
