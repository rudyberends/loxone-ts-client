import { describe, expect, it } from 'vitest';
import { TokenManager } from '../src/auth/TokenManager.js';
import { NoopLogger } from '../src/logging/Logger.js';
import { TextMessage } from '../src/protocol/messages/TextMessage.js';
import type { WebSocketConnection } from '../src/transport/WebSocketConnection.js';

/** A fake connection that answers getkey2 and getjwt with canned 200 responses. */
function fakeConnection(): WebSocketConnection {
  const reply = (control: string, value: unknown): TextMessage =>
    new TextMessage(JSON.stringify({ LL: { control, code: '200', value } }));
  return {
    sendCommand: (command: string) => {
      if (command.includes('getkey2')) {
        return Promise.resolve(reply(command, { key: '00ff', salt: 'salt', hashAlg: 'SHA256' }));
      }
      if (command.includes('getjwt')) {
        return Promise.resolve(reply(command, { token: 'THE_TOKEN', validUntil: 9_999_999_999, tokenRights: 4 }));
      }
      return Promise.resolve(reply(command, '1'));
    },
  } as unknown as WebSocketConnection;
}

describe('TokenManager onTokenChanged isolation', () => {
  it('a throwing onTokenChanged does not break token acquisition', async () => {
    let fired = 0;
    const tm = new TokenManager(fakeConnection(), 'user', 'pass', new NoopLogger(), {
      autoRefresh: false,
      onTokenChanged: () => {
        fired++;
        throw new Error('persist failed');
      },
    });
    const info = await tm.acquireToken(); // must resolve despite the throwing callback
    expect(info.token).toBe('THE_TOKEN');
    expect(tm.token).toBe('THE_TOKEN');
    expect(fired).toBe(1); // callback was invoked exactly once
  });
});
