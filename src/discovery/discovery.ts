import dgram from 'node:dgram';
import { networkInterfaces } from 'node:os';

/**
 * LAN discovery of Loxone Miniservers via the (reverse-engineered) UDP probe:
 * a client sends a single `0x00` byte to UDP port {@link DISCOVERY_PROBE_PORT}
 * (7070) and listens on the fixed reply port {@link DISCOVERY_REPLY_PORT} (7071)
 * for a `LoxLIVE: …` identification line.
 *
 * This is a **best-effort, LAN-only** mechanism: UDP broadcast does not cross
 * subnets/VLANs/routers, so it finds Miniservers only on the local segment. The
 * packet format is not part of Loxone's official protocol and may change across
 * firmware. Ideal for a setup/config UI (e.g. listing Miniservers to pick from)
 * with a manual host entry as the fallback.
 *
 * Node-only: it uses `node:dgram` and so is not available in the browser.
 */

/** UDP port a Miniserver listens on for the discovery probe. */
export const DISCOVERY_PROBE_PORT = 7070;
/** Fixed UDP port a Miniserver sends its discovery reply to. */
export const DISCOVERY_REPLY_PORT = 7071;

/** A Miniserver found on the network (parsed from its `LoxLIVE:` reply). */
export interface DiscoveredMiniserver {
  /** Friendly name, e.g. `"Demo House/Ground Floor"`. */
  name: string;
  /** IPv4 address, e.g. `"192.168.50.10"`. */
  host: string;
  /** HTTP port, e.g. `80`. */
  port: number;
  /** `"host:port"`, ready to hand to `new LoxoneClient(address, …)`. */
  address: string;
  /** 12-hex-char serial (the MAC-like device id), e.g. `"504F94ABCDEF"`. */
  serial: string;
  /** Firmware version, e.g. `"14.5.12.30"`. */
  firmwareVersion: string;
  /** Loxone Config file timestamp (`Prog:`), when present. */
  configDate: string | undefined;
  /** Hardware type code (`Type:`), when present. */
  type: number | undefined;
  /** Hardware id (`HwId:`), when present. */
  hwId: string | undefined;
  /** The raw `LoxLIVE:` line as received. */
  raw: string;
}

const LOX_LIVE_PREFIX = 'LoxLIVE:';
const IPV4_PORT = /(\d{1,3}(?:\.\d{1,3}){3}):(\d+)/;

/**
 * Parses a `LoxLIVE: …` discovery line into a {@link DiscoveredMiniserver}, or
 * returns `undefined` if it isn't a recognisable reply. The device name may
 * itself contain spaces, so the IPv4 `host:port` token (not whitespace) anchors
 * the parse; the remaining fields are read by their labels where present.
 */
export function parseLoxLive(line: string): DiscoveredMiniserver | undefined {
  const raw = line.trim();
  if (!raw.startsWith(LOX_LIVE_PREFIX)) return undefined;
  const body = raw.slice(LOX_LIVE_PREFIX.length).trim();

  const addr = IPV4_PORT.exec(body);
  if (!addr) return undefined;
  const host = addr[1]!;
  const port = Number(addr[2]);

  const name = body.slice(0, addr.index).trim();
  // After the address: "<serial> <firmware> Prog:<date> Type:<n> HwId:<x> IPv6:…"
  const tail = body.slice(addr.index + addr[0].length).trim();
  const tokens = tail.split(/\s+/);
  const serial = tokens[0] ?? '';
  const firmwareVersion = tokens[1] ?? '';

  const prog = /Prog:(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/.exec(tail);
  const typeMatch = /Type:(\d+)/.exec(tail);
  const hwId = /HwId:(\S+)/.exec(tail);

  return {
    name,
    host,
    port,
    address: `${host}:${port}`,
    serial,
    firmwareVersion,
    configDate: prog?.[1],
    type: typeMatch ? Number(typeMatch[1]) : undefined,
    hwId: hwId?.[1],
    raw,
  };
}

/** Global + per-interface directed broadcast addresses to maximise reach. */
function broadcastAddresses(): string[] {
  const out = new Set<string>(['255.255.255.255']);
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family !== 'IPv4' || iface.internal) continue;
      const addr = iface.address.split('.').map(Number);
      const mask = iface.netmask.split('.').map(Number);
      if (addr.length === 4 && mask.length === 4 && mask.every((m) => m >= 0)) {
        out.add(addr.map((octet, i) => (octet & mask[i]!) | (~mask[i]! & 0xff)).join('.'));
      }
    }
  }
  return [...out];
}

/** Options for {@link discoverMiniservers} / {@link identifyMiniserver}. */
export interface DiscoveryOptions {
  /** How long to listen for replies, in ms (default `3000`). */
  timeoutMs?: number;
  /** Abort the discovery early; resolves with whatever was found so far. */
  signal?: AbortSignal;
}

/**
 * Discovers Loxone Miniservers on the local network. Broadcasts the `0x00`
 * probe and collects `LoxLIVE:` replies for `timeoutMs`, de-duplicated by serial.
 * Resolves to the Miniservers found (possibly empty). LAN-segment-only — see the
 * module docs.
 */
export function discoverMiniservers(options: DiscoveryOptions = {}): Promise<DiscoveredMiniserver[]> {
  const timeoutMs = options.timeoutMs ?? 3000;
  return new Promise<DiscoveredMiniserver[]>((resolve, reject) => {
    const found = new Map<string, DiscoveredMiniserver>();
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    let settled = false;

    const finish = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', finish);
      try {
        socket.close();
      } catch {
        /* already closed */
      }
      resolve([...found.values()]);
    };
    const fail = (err: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', finish);
      try {
        socket.close();
      } catch {
        /* already closed */
      }
      reject(err);
    };

    socket.on('message', (msg) => {
      const ms = parseLoxLive(msg.toString('latin1'));
      if (ms) found.set(ms.serial || ms.address, ms);
    });
    socket.on('error', fail);

    const timer = setTimeout(finish, timeoutMs);
    if (options.signal) {
      if (options.signal.aborted) return finish();
      options.signal.addEventListener('abort', finish, { once: true });
    }

    // Bind to the reply port so our source port matches the port the Miniserver
    // replies to (it answers on a fixed 7071, not the request's source port).
    socket.bind(DISCOVERY_REPLY_PORT, () => {
      try {
        socket.setBroadcast(true);
      } catch {
        /* some platforms disallow broadcast; unicast probes still work */
      }
      const probe = Buffer.from([0x00]);
      for (const addr of broadcastAddresses()) {
        socket.send(probe, DISCOVERY_PROBE_PORT, addr, () => {
          /* per-target send errors are non-fatal; keep listening */
        });
      }
    });
  });
}

/**
 * Probes a single known host for its Miniserver identity (unicast). Unlike
 * {@link discoverMiniservers} this works across routed networks, so it's a handy
 * no-auth pre-flight ("is this a Miniserver, and which one?"). Resolves to the
 * Miniserver, or `undefined` if none replied within `timeoutMs`.
 */
export function identifyMiniserver(
  host: string,
  options: DiscoveryOptions = {},
): Promise<DiscoveredMiniserver | undefined> {
  const timeoutMs = options.timeoutMs ?? 3000;
  return new Promise<DiscoveredMiniserver | undefined>((resolve, reject) => {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    let settled = false;

    const settle = (value: DiscoveredMiniserver | undefined, err?: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      try {
        socket.close();
      } catch {
        /* already closed */
      }
      if (err) reject(err);
      else resolve(value);
    };
    const onAbort = (): void => settle(undefined);

    socket.on('message', (msg) => {
      const ms = parseLoxLive(msg.toString('latin1'));
      if (ms) settle(ms);
    });
    socket.on('error', (err) => settle(undefined, err));

    const timer = setTimeout(() => settle(undefined), timeoutMs);
    if (options.signal) {
      if (options.signal.aborted) return settle(undefined);
      options.signal.addEventListener('abort', onAbort, { once: true });
    }

    socket.bind(DISCOVERY_REPLY_PORT, () => {
      socket.send(Buffer.from([0x00]), DISCOVERY_PROBE_PORT, host, (err) => {
        if (err) settle(undefined, err);
      });
    });
  });
}
