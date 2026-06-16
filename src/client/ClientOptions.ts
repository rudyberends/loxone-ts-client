import type { AuthenticatorOptions } from '../auth/Authenticator.js';
import type { Logger } from '../logging/Logger.js';
import { NoopLogger } from '../logging/Logger.js';
import type { FetchLike } from '../transport/HttpClient.js';

/** Options for constructing a {@link ../LoxoneClient.LoxoneClient}. */
export interface LoxoneClientOptions {
  /**
   * Use TLS (`wss://` / `https://`). Requires a new-generation Miniserver and a
   * hostname that matches its certificate. Default `false`.
   */
  useTls?: boolean;
  /** Logger to receive diagnostics. Defaults to a no-op logger (silent). */
  logger?: Logger;
  /** Per-command response timeout in milliseconds. Default 15000. */
  commandTimeoutMs?: number;
  /** Whether to send periodic keepalives to hold the connection open. Default true. */
  keepAlive?: boolean;
  /** Keepalive interval in milliseconds. Default 15000 (the Miniserver closes idle sockets after ~5 min). */
  keepAliveIntervalMs?: number;
  /** Whether to automatically reconnect (with backoff) after an unexpected disconnect. Default true. */
  autoReconnect?: boolean;
  /** Initial reconnect delay in milliseconds (doubles up to {@link maxReconnectDelayMs}). Default 1000. */
  reconnectDelayMs?: number;
  /** Maximum reconnect delay in milliseconds. Default 30000. */
  maxReconnectDelayMs?: number;
  /**
   * Force command encryption regardless of generation/TLS. By default the client
   * encrypts when not using TLS (required for Gen-1) and skips it over TLS.
   */
  forceEncryption?: boolean;
  /** Whether to keep the latest event on each {@link ../structure/State.State}. Default true. */
  trackStateValues?: boolean;
  /**
   * Quiet period (ms) after the last update, used to decide the initial state
   * burst has settled and fire `statesSettled`. Default 1000.
   */
  settleDebounceMs?: number;
  /**
   * Download and parse the structure file automatically during {@link
   * ../LoxoneClient.LoxoneClient.connect | connect()}, so `structure`/`items()`
   * are ready as soon as it resolves. Default `true`. Set `false` if you only
   * send commands by UUID and want to skip the (potentially large) `LoxAPP3.json`
   * download; you can still call `loadStructure()` yourself.
   */
  loadStructureOnConnect?: boolean;
  /**
   * Start the live binary state stream automatically during {@link
   * ../LoxoneClient.LoxoneClient.connect | connect()}, so `item.onChange`/
   * `onAnyChange` work immediately. Default `true`. Set `false` to start it
   * yourself with `enableUpdates()` (e.g. to attach an `onAnyChange` firehose
   * before the initial state burst).
   */
  enableUpdatesOnConnect?: boolean;
  /** Token acquisition/refresh options (permission, client UUID/info, auto-refresh). */
  auth?: AuthenticatorOptions;
  /** Custom `fetch` implementation for HTTP bootstrap requests (advanced/TLS scenarios). */
  fetchImpl?: FetchLike;
}

/** Resolved options with all defaults applied. */
export interface ResolvedClientOptions {
  useTls: boolean;
  logger: Logger;
  commandTimeoutMs: number;
  keepAlive: boolean;
  keepAliveIntervalMs: number;
  autoReconnect: boolean;
  reconnectDelayMs: number;
  maxReconnectDelayMs: number;
  forceEncryption: boolean;
  trackStateValues: boolean;
  settleDebounceMs: number;
  loadStructureOnConnect: boolean;
  enableUpdatesOnConnect: boolean;
  auth: AuthenticatorOptions;
  fetchImpl: FetchLike | undefined;
}

/** Applies defaults to user-supplied {@link LoxoneClientOptions}. */
export function resolveOptions(options: LoxoneClientOptions = {}): ResolvedClientOptions {
  return {
    useTls: options.useTls ?? false,
    logger: options.logger ?? new NoopLogger(),
    commandTimeoutMs: options.commandTimeoutMs ?? 15_000,
    keepAlive: options.keepAlive ?? true,
    keepAliveIntervalMs: options.keepAliveIntervalMs ?? 15_000,
    autoReconnect: options.autoReconnect ?? true,
    reconnectDelayMs: options.reconnectDelayMs ?? 1_000,
    maxReconnectDelayMs: options.maxReconnectDelayMs ?? 30_000,
    forceEncryption: options.forceEncryption ?? false,
    trackStateValues: options.trackStateValues ?? true,
    settleDebounceMs: options.settleDebounceMs ?? 1_000,
    loadStructureOnConnect: options.loadStructureOnConnect ?? true,
    enableUpdatesOnConnect: options.enableUpdatesOnConnect ?? true,
    auth: options.auth ?? {},
    fetchImpl: options.fetchImpl,
  };
}
