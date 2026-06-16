import { LoxoneAuthenticationError } from '../errors.js';
import type { Logger } from '../logging/Logger.js';
import { loxoneEpochToDate } from '../protocol/loxoneEpoch.js';
import type { TextMessage } from '../protocol/messages/TextMessage.js';
import type { WebSocketConnection } from '../transport/WebSocketConnection.js';
import { buildPasswordHash, buildTokenHash, buildUserHash, hexKeyToBytes } from './hashing.js';

/** Loxone permission bit-flags (a subset; the two important ones for connecting are Web and App). */
export enum TokenPermission {
  /** Short-lived token for the web interface. */
  Web = 2,
  /** Long-lived token for apps/integrations. Recommended for background services. */
  App = 4,
}

/** Details of an acquired token. */
export interface TokenInfo {
  /** The JSON Web Token (or legacy token) itself. */
  token: string;
  /** Expiry, as a JS Date (converted from seconds-since-2009 UTC). */
  validUntil: Date;
  /** Bitmap of granted permission flags. */
  rights: number;
  /** True if the account uses a weak password (warn the user). */
  unsecurePassword: boolean;
}

/** Configuration controlling how tokens are acquired and maintained. */
export interface TokenManagerOptions {
  /** Permission to request. Default {@link TokenPermission.App} (long-lived). */
  permission?: number;
  /**
   * Stable client UUID identifying this client to the Miniserver (format
   * `098802e1-02b4-603c-ffffeee000d80cfd`). Provide a persistent value so the
   * Miniserver can track and reuse this client's tokens; defaults to a random one.
   */
  clientUuid?: string;
  /** Human-readable client description (will be URL-encoded). */
  clientInfo?: string;
  /** How long before expiry to attempt an automatic refresh. Default 2 hours. */
  refreshBufferMs?: number;
  /** Whether to schedule automatic token refresh. Default true. */
  autoRefresh?: boolean;
  /**
   * Called whenever the token changes — on acquisition, manual refresh, and
   * automatic background refresh. Persist `info.token` here so it survives a
   * restart (pass it back via `connect(token)`).
   */
  onTokenChanged?: (info: TokenInfo) => void;
}

const REFRESH_RETRY_BASE_MS = 5 * 60 * 1000;
const MAX_REFRESH_RETRIES = 5;
const MAX_TIMER_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Acquires, refreshes, verifies and revokes Loxone authentication tokens, and
 * keeps a valid token alive by scheduling refreshes before expiry.
 *
 * All commands here are sent encrypted (`getjwt` is rejected otherwise), so an
 * encryptor must be configured on the connection before use.
 */
export class TokenManager {
  private current: TokenInfo | undefined;
  private userKey: Buffer | undefined;
  private hashAlg: string | undefined;
  private userSalt: string | undefined;

  private refreshTimer: ReturnType<typeof setTimeout> | undefined;
  private refreshRetries = 0;

  private readonly permission: number;
  private readonly clientUuid: string;
  private readonly clientInfo: string;
  private readonly refreshBufferMs: number;
  private readonly autoRefresh: boolean;
  private readonly onTokenChanged: ((info: TokenInfo) => void) | undefined;

  constructor(
    private readonly connection: WebSocketConnection,
    private readonly username: string,
    private readonly password: string,
    private readonly log: Logger,
    options: TokenManagerOptions = {},
  ) {
    this.permission = options.permission ?? TokenPermission.App;
    this.clientUuid = options.clientUuid ?? randomClientUuid();
    this.clientInfo = options.clientInfo ?? 'loxone-ts-client';
    this.refreshBufferMs = options.refreshBufferMs ?? 2 * 60 * 60 * 1000;
    this.autoRefresh = options.autoRefresh ?? true;
    this.onTokenChanged = options.onTokenChanged;
  }

  /** The current token, or `undefined` if none has been acquired. */
  get token(): string | undefined {
    return this.current?.token;
  }

  /** Full details of the current token. */
  get info(): TokenInfo | undefined {
    return this.current;
  }

  /** Records a new token and notifies listeners. */
  private setCurrent(info: TokenInfo): void {
    this.current = info;
    this.scheduleRefresh();
    // The notification is a side-effect: a throwing listener must never unwind
    // token acquisition/refresh (it would reject connect() or stall auto-refresh).
    try {
      this.onTokenChanged?.(info);
    } catch (error) {
      this.log.error(`onTokenChanged listener threw: ${(error as Error).message}`);
    }
  }

  /** Fetches `key`, `salt` and `hashAlg` for the user via `getkey2`. */
  private async loadUserKey(): Promise<void> {
    const response = await this.connection.sendCommand(`jdev/sys/getkey2/${encodeURIComponent(this.username)}`, {
      encrypt: true,
    });
    response.ensureOk('getkey2');
    const value = response.asRecord<{ key?: string; salt?: string; hashAlg?: string }>();
    if (!value?.key || !value.salt) {
      throw new LoxoneAuthenticationError('getkey2 response missing key/salt');
    }
    this.userKey = hexKeyToBytes(value.key);
    this.userSalt = value.salt;
    this.hashAlg = value.hashAlg;
  }

  private requireUserKey(): Buffer {
    if (!this.userKey) throw new LoxoneAuthenticationError('User key not loaded');
    return this.userKey;
  }

  /** Acquires a brand-new token using username/password. */
  async acquireToken(): Promise<TokenInfo> {
    await this.loadUserKey();
    const pwHash = buildPasswordHash(this.password, this.userSalt!, this.hashAlg);
    const userHash = buildUserHash(this.username, pwHash, this.requireUserKey(), this.hashAlg);
    const command =
      `jdev/sys/getjwt/${userHash}/${encodeURIComponent(this.username)}` +
      `/${this.permission}/${this.clientUuid}/${encodeURIComponent(this.clientInfo)}`;
    const response = await this.connection.sendCommand(command, { encrypt: true });
    response.ensureOk('getjwt');
    const info = this.parseTokenResponse(response);
    this.log.info(`Acquired token (valid until ${info.validUntil.toISOString()})`);
    this.setCurrent(info);
    return info;
  }

  /** Authenticates the current socket using an existing token. */
  async authenticateWithToken(token: string): Promise<TokenInfo> {
    await this.loadUserKey();
    const tokenHash = buildTokenHash(token, this.requireUserKey(), this.hashAlg);
    const response = await this.connection.sendCommand(
      `authwithtoken/${tokenHash}/${encodeURIComponent(this.username)}`,
      { encrypt: true },
    );
    response.ensureOk('authwithtoken');
    // authwithtoken echoes validUntil/rights but not a new token; keep the supplied one.
    const info = this.parseTokenResponse(response, token);
    this.log.info('Authenticated with existing token');
    this.setCurrent(info);
    return info;
  }

  /** Refreshes the current token, extending its lifespan. */
  async refreshToken(): Promise<TokenInfo> {
    if (!this.current) throw new LoxoneAuthenticationError('No token to refresh');
    if (this.current.validUntil.getTime() <= Date.now()) {
      this.log.warn('Token already expired; acquiring a new one');
      return this.acquireToken();
    }
    await this.loadUserKey();
    const tokenHash = buildTokenHash(this.current.token, this.requireUserKey(), this.hashAlg);
    const response = await this.connection.sendCommand(
      `jdev/sys/refreshjwt/${tokenHash}/${encodeURIComponent(this.username)}`,
      { encrypt: true },
    );
    response.ensureOk('refreshjwt');
    const info = this.parseTokenResponse(response, this.current.token);
    this.log.info(`Refreshed token (valid until ${info.validUntil.toISOString()})`);
    this.setCurrent(info);
    return info;
  }

  /** Checks whether a token is still valid (without refreshing it). */
  async checkToken(token = this.current?.token): Promise<boolean> {
    if (!token) return false;
    await this.loadUserKey();
    const tokenHash = buildTokenHash(token, this.requireUserKey(), this.hashAlg);
    const response = await this.connection.sendCommand(
      `jdev/sys/checktoken/${tokenHash}/${encodeURIComponent(this.username)}`,
      { encrypt: true },
    );
    return response.ok;
  }

  /** Revokes the current token and stops auto-refresh. Best-effort. */
  async killToken(): Promise<void> {
    this.clearRefresh();
    if (!this.current) return;
    try {
      await this.loadUserKey();
      const tokenHash = buildTokenHash(this.current.token, this.requireUserKey(), this.hashAlg);
      await this.connection.sendCommand(`jdev/sys/killtoken/${tokenHash}/${encodeURIComponent(this.username)}`, {
        encrypt: true,
      });
      this.log.info('Token killed');
    } catch (error) {
      this.log.debug(`Ignoring error while killing token: ${(error as Error).message}`);
    } finally {
      this.current = undefined;
    }
  }

  /** Stops the scheduled refresh timer. */
  clearRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  private parseTokenResponse(response: TextMessage, fallbackToken?: string): TokenInfo {
    const value = response.asRecord<{
      token?: string;
      validUntil?: number | string;
      tokenRights?: number | string;
      unsecurePass?: boolean | string;
    }>();
    const token = value?.token ?? fallbackToken;
    if (!token) throw new LoxoneAuthenticationError('Token response missing token');
    const seconds = Number(value?.validUntil ?? 0);
    return {
      token,
      validUntil: loxoneEpochToDate(seconds),
      rights: Number(value?.tokenRights ?? 0),
      unsecurePassword: value?.unsecurePass === true || value?.unsecurePass === 'true',
    };
  }

  private scheduleRefresh(): void {
    this.clearRefresh();
    if (!this.autoRefresh || !this.current) return;

    const msUntilExpiry = this.current.validUntil.getTime() - Date.now();
    const delay = Math.max(0, Math.min(msUntilExpiry - this.refreshBufferMs, MAX_TIMER_MS));
    this.log.debug(`Scheduling token refresh in ${Math.round(delay / 1000)}s`);

    this.refreshTimer = setTimeout(() => {
      void this.refreshToken()
        .then(() => {
          this.refreshRetries = 0;
        })
        .catch((error: Error) => {
          this.refreshRetries += 1;
          this.log.error(`Token refresh failed (attempt ${this.refreshRetries}): ${error.message}`);
          if (this.refreshRetries <= MAX_REFRESH_RETRIES) {
            this.refreshTimer = setTimeout(() => this.scheduleRefresh(), REFRESH_RETRY_BASE_MS * this.refreshRetries);
            if (typeof this.refreshTimer.unref === 'function') this.refreshTimer.unref();
          } else {
            this.log.error('Giving up on automatic token refresh');
          }
        });
    }, delay);
    if (typeof this.refreshTimer.unref === 'function') this.refreshTimer.unref();
  }
}

/** Generates a random UUID in the Loxone token format `xxxxxxxx-xxxx-xxxx-xxxxxxxxxxxxxxxx`. */
function randomClientUuid(): string {
  const hex = (n: number): string =>
    Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${hex(8)}-${hex(4)}-${hex(4)}-${hex(16)}`;
}
