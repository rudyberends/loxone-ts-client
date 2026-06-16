import { createHash, createHmac } from 'node:crypto';

/**
 * Hashing helpers used during Loxone authentication.
 *
 * The Miniserver advertises which algorithm to use via the `hashAlg` field of
 * the `getkey2` / `getvisusalt` responses (`"SHA1"` or `"SHA256"`). All hashing
 * must honour that value — hardcoding one algorithm breaks against Miniservers
 * configured for the other.
 */

/** Hashing algorithm as advertised by the Miniserver. */
export type HashAlgorithm = 'SHA1' | 'SHA256';

/** Maps a Loxone `hashAlg` string to the Node.js digest name. Defaults to SHA-256. */
export function nodeDigest(hashAlg: string | undefined): 'sha1' | 'sha256' {
  return String(hashAlg).toUpperCase() === 'SHA1' ? 'sha1' : 'sha256';
}

/**
 * Plain hash of `payload`, hex-encoded.
 * Used for `pwHash`/`visuPwHash` over `"{secret}:{salt}"`.
 */
export function hashHex(payload: string, hashAlg: string | undefined): string {
  return createHash(nodeDigest(hashAlg)).update(payload).digest('hex');
}

/**
 * HMAC of `payload` keyed with the (raw) `key` bytes, hex-encoded.
 *
 * The `key` returned by `getkey`/`getkey2` is a **hex string** and must be
 * decoded to raw bytes before being used as the HMAC key — pass the decoded
 * Buffer here (see {@link hexKeyToBytes}).
 */
export function hmacHex(payload: string, key: Buffer, hashAlg: string | undefined): string {
  return createHmac(nodeDigest(hashAlg), key).update(payload).digest('hex');
}

/** Decodes the hex-encoded key from a `getkey`/`getkey2` response to raw bytes. */
export function hexKeyToBytes(hexKey: string): Buffer {
  return Buffer.from(hexKey, 'hex');
}

/**
 * Builds the password hash used for token acquisition.
 * `pwHash = UPPERCASE( hash( "{password}:{userSalt}" ) )`.
 */
export function buildPasswordHash(password: string, userSalt: string, hashAlg: string | undefined): string {
  return hashHex(`${password}:${userSalt}`, hashAlg).toUpperCase();
}

/**
 * Builds the user-authentication hash used for `getjwt`.
 * `hash = HMAC( key, "{user}:{pwHash}" )` — left as-is (not upper/lower-cased).
 */
export function buildUserHash(user: string, pwHash: string, key: Buffer, hashAlg: string | undefined): string {
  return hmacHex(`${user}:${pwHash}`, key, hashAlg);
}

/**
 * Builds the token hash used for `authwithtoken`/`refreshjwt`/`checktoken`/`killtoken`.
 * `tokenHash = HMAC( key, token )`.
 */
export function buildTokenHash(token: string, key: Buffer, hashAlg: string | undefined): string {
  return hmacHex(token, key, hashAlg);
}
