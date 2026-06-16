import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildPasswordHash,
  buildTokenHash,
  buildUserHash,
  hashHex,
  hexKeyToBytes,
  hmacHex,
  nodeDigest,
} from '../src/auth/hashing.js';

describe('nodeDigest', () => {
  it('maps Loxone hashAlg values to Node digest names', () => {
    expect(nodeDigest('SHA1')).toBe('sha1');
    expect(nodeDigest('SHA256')).toBe('sha256');
    expect(nodeDigest('sha1')).toBe('sha1');
    expect(nodeDigest(undefined)).toBe('sha256');
    expect(nodeDigest('anything-else')).toBe('sha256');
  });
});

describe('hashHex / hmacHex', () => {
  it('matches a direct crypto computation for SHA-256', () => {
    const expected = createHash('sha256').update('hello:salt').digest('hex');
    expect(hashHex('hello:salt', 'SHA256')).toBe(expected);
  });

  it('matches a direct crypto computation for SHA-1', () => {
    const expected = createHash('sha1').update('hello:salt').digest('hex');
    expect(hashHex('hello:salt', 'SHA1')).toBe(expected);
  });

  it('honours the algorithm for HMAC (regression: not hardcoded to sha256)', () => {
    const key = hexKeyToBytes('00ff10');
    expect(hmacHex('payload', key, 'SHA1')).toBe(createHmac('sha1', key).update('payload').digest('hex'));
    expect(hmacHex('payload', key, 'SHA256')).toBe(createHmac('sha256', key).update('payload').digest('hex'));
  });
});

describe('hexKeyToBytes', () => {
  it('decodes a hex string to raw bytes', () => {
    expect([...hexKeyToBytes('48656c6c6f')]).toEqual([...Buffer.from('Hello', 'utf8')]);
  });
});

describe('password / user / token hashes', () => {
  const key = hexKeyToBytes('1a2b3c4d5e6f');

  it('uppercases the password hash', () => {
    const pw = buildPasswordHash('secret', 'somesalt', 'SHA256');
    expect(pw).toBe(pw.toUpperCase());
    expect(pw).toBe(createHash('sha256').update('secret:somesalt').digest('hex').toUpperCase());
  });

  it('builds the user hash as HMAC(key, "user:pwHash")', () => {
    const pwHash = buildPasswordHash('secret', 'salt', 'SHA256');
    expect(buildUserHash('admin', pwHash, key, 'SHA256')).toBe(
      createHmac('sha256', key).update(`admin:${pwHash}`).digest('hex'),
    );
  });

  it('builds the token hash as HMAC(key, token)', () => {
    expect(buildTokenHash('the-token', key, 'SHA1')).toBe(createHmac('sha1', key).update('the-token').digest('hex'));
  });
});
