import { LoxoneAuthenticationError } from '../errors.js';
import type { Logger } from '../logging/Logger.js';
import type { HttpClient } from '../transport/HttpClient.js';
import type { WebSocketConnection } from '../transport/WebSocketConnection.js';
import { extractPublicKeyPem } from './certificate.js';
import { CommandEncryption } from './CommandEncryption.js';
import { SecuredCommands } from './SecuredCommands.js';
import { TokenManager, type TokenInfo, type TokenManagerOptions } from './TokenManager.js';

/** Options forwarded to the {@link TokenManager}. */
export type AuthenticatorOptions = TokenManagerOptions;

/**
 * Orchestrates the full authentication handshake over an open WebSocket:
 *  1. fetch the Miniserver certificate/public key,
 *  2. establish the AES session key (RSA key exchange) and wire up command encryption,
 *  3. acquire a new token or authenticate with an existing one.
 *
 * Owns the {@link TokenManager} and {@link SecuredCommands} for the session.
 */
export class Authenticator {
  readonly tokens: TokenManager;
  readonly secured: SecuredCommands;
  private readonly encryption = new CommandEncryption();

  constructor(
    private readonly connection: WebSocketConnection,
    private readonly http: HttpClient,
    private readonly username: string,
    password: string,
    private readonly log: Logger,
    options: AuthenticatorOptions = {},
  ) {
    this.tokens = new TokenManager(connection, username, password, log, options);
    this.secured = new SecuredCommands(connection, username);
  }

  /** Runs key exchange and authenticates, acquiring a token if none is supplied. */
  async authenticate(existingToken?: string): Promise<TokenInfo> {
    await this.exchangeSessionKey();
    if (existingToken) {
      try {
        return await this.tokens.authenticateWithToken(existingToken);
      } catch (error) {
        this.log.warn(`Existing token rejected (${(error as Error).message}); acquiring a new one`);
        return this.tokens.acquireToken();
      }
    }
    return this.tokens.acquireToken();
  }

  /** Fetches the public key, establishes the AES session key, and enables encryption. */
  private async exchangeSessionKey(): Promise<void> {
    const publicKeyPem = await this.fetchPublicKey();

    // Wire up the encryptor *before* the key exchange completes so subsequent
    // token commands (which require encryption) can be encrypted.
    this.connection.setEncryptor((command) => this.encryption.encryptCommand(command));

    const sessionKey = this.encryption.encryptSessionKey(publicKeyPem);
    const response = await this.connection.sendCommand(`jdev/sys/keyexchange/${sessionKey}`, { encrypt: false });
    if (!response.ok) {
      throw new LoxoneAuthenticationError(`Key exchange failed with code ${response.code}`);
    }
    this.log.debug('Session key exchanged');
  }

  private async fetchPublicKey(): Promise<string> {
    // Fetched over HTTP(S) — `getcertificate` returns the raw PEM certificate
    // chain there; the last (leaf) certificate carries the Miniserver's key.
    const pem = await this.http.getCertificate();
    return extractPublicKeyPem(pem);
  }

  /** Disables command encryption (e.g. on disconnect). */
  reset(): void {
    this.connection.setEncryptor(undefined);
  }
}
