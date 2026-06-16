import { createDecipheriv, generateKeyPairSync, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CommandEncryption } from '../src/auth/CommandEncryption.js';

// A 2048-bit RSA public key standing in for the Miniserver's certificate key.
// (Node 22 blocks PKCS#1 v1.5 *private* decryption, so we don't simulate the
// Miniserver side here — we assert the produced ciphertext shape instead.)
const { publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const KEY = randomBytes(32);
const IV = randomBytes(16);

function decrypt(wire: string): string {
  expect(wire.startsWith('jdev/sys/enc/')).toBe(true);
  const cipherB64 = decodeURIComponent(wire.slice('jdev/sys/enc/'.length));
  const decipher = createDecipheriv('aes-256-cbc', KEY, IV);
  decipher.setAutoPadding(false); // the client uses zero-byte padding
  const out = Buffer.concat([decipher.update(Buffer.from(cipherB64, 'base64')), decipher.final()]);
  return out.toString('utf8').replace(/\0+$/, ''); // strip zero padding
}

describe('CommandEncryption', () => {
  it('RSA-encrypts the session key to a 256-byte ciphertext (2048-bit key)', () => {
    const sessionKeyB64 = new CommandEncryption({ key: KEY, iv: IV }).encryptSessionKey(publicKey);
    expect(Buffer.from(sessionKeyB64, 'base64')).toHaveLength(256);
  });

  it('encrypts a command that AES-decrypts back to "salt/{salt}/{cmd}"', () => {
    const enc = new CommandEncryption({ key: KEY, iv: IV });
    expect(decrypt(enc.encryptCommand('jdev/sps/io/AI1/on'))).toMatch(/^salt\/[0-9a-f%]+\/jdev\/sps\/io\/AI1\/on$/);
  });

  it('uses the fenc prefix when an encrypted response is requested', () => {
    const enc = new CommandEncryption({ key: KEY, iv: IV });
    expect(enc.encryptCommandWithEncryptedResponse('jdev/sps/io/x/on').startsWith('jdev/sys/fenc/')).toBe(true);
  });

  it('rotates the salt to the "nextSalt/{prev}/{next}" form after maxSaltUses', () => {
    const enc = new CommandEncryption({ key: KEY, iv: IV, maxSaltUses: 2 });
    decrypt(enc.encryptCommand('a')); // use 1
    decrypt(enc.encryptCommand('b')); // use 2 -> reaches max
    expect(decrypt(enc.encryptCommand('c')).startsWith('nextSalt/')).toBe(true);
  });
});
