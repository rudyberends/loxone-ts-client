import { LoxoneAuthenticationError, LoxoneCommandError } from '../errors.js';
import type { TextMessage } from '../protocol/messages/TextMessage.js';
import type { WebSocketConnection } from '../transport/WebSocketConnection.js';
import { hashHex, hexKeyToBytes, hmacHex } from './hashing.js';

/**
 * Implements "secured commands" — control commands protected by a per-control
 * *visualization password* (configured in Loxone Config).
 *
 * Flow per the spec:
 *  1. `jdev/sys/getvisusalt/{user}` → `{ key, salt, hashAlg }`
 *  2. `visuPwHash = UPPER( hash("{visuPw}:{salt}") )`
 *  3. `hash = HMAC(key, visuPwHash)`
 *  4. `jdev/sps/ios/{hash}/{uuid}/{command}` to execute (code 200 ok, 500 = wrong password)
 */
export class SecuredCommands {
  constructor(
    private readonly connection: WebSocketConnection,
    private readonly username: string,
  ) {}

  /** Fetches the per-user visualization salt/key/hashAlg. */
  private async getVisuSalt(encrypt: boolean): Promise<{ key: Buffer; salt: string; hashAlg: string | undefined }> {
    const response = await this.connection.sendCommand(`jdev/sys/getvisusalt/${encodeURIComponent(this.username)}`, {
      encrypt,
    });
    response.ensureOk('getvisusalt');
    const value = response.asRecord<{ key?: string; salt?: string; hashAlg?: string }>();
    if (!value?.key || !value.salt) {
      throw new LoxoneAuthenticationError('getvisusalt response missing key/salt');
    }
    return { key: hexKeyToBytes(value.key), salt: value.salt, hashAlg: value.hashAlg };
  }

  /** Builds the secured-command hash from the visualization password. */
  private async buildHash(visuPassword: string, encrypt: boolean): Promise<string> {
    const { key, salt, hashAlg } = await this.getVisuSalt(encrypt);
    const visuPwHash = hashHex(`${visuPassword}:${salt}`, hashAlg).toUpperCase();
    return hmacHex(visuPwHash, key, hashAlg);
  }

  /**
   * Executes a secured control command using the visualization password.
   * @throws {LoxoneCommandError} when the password is wrong (Miniserver code 500).
   */
  async sendSecuredCommand(
    uuid: string,
    command: string,
    visuPassword: string,
    options: { encrypt?: boolean; timeoutMs?: number } = {},
  ): Promise<TextMessage> {
    const encrypt = options.encrypt ?? true;
    const hash = await this.buildHash(visuPassword, encrypt);
    const wire = `jdev/sps/ios/${hash}/${uuid}/${command}`;
    const response = await this.connection.sendCommand(wire, {
      encrypt,
      ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
    });
    if (response.code === 500) {
      throw new LoxoneCommandError('Incorrect visualization password', {
        code: 500,
        command: `${uuid}/${command}`,
        kind: 'unauthorized',
      });
    }
    return response.ensureOk(`${uuid}/${command}`);
  }

  /** Verifies a visualization password without triggering any control. */
  async checkVisuPassword(visuPassword: string, options: { encrypt?: boolean } = {}): Promise<boolean> {
    const encrypt = options.encrypt ?? true;
    const hash = await this.buildHash(visuPassword, encrypt);
    const response = await this.connection.sendCommand(`jdev/sps/checkuservisupwd/${hash}`, { encrypt });
    return response.ok;
  }
}
