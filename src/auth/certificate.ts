import { LoxoneAuthenticationError } from '../errors.js';

const CERT_BLOCK = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g;
const PUBKEY_BLOCK = /-----BEGIN PUBLIC KEY-----[\s\S]+?-----END PUBLIC KEY-----/g;

/**
 * Extracts the public key material from a `getcertificate` (or `getPublicKey`)
 * response. The response may be a raw PEM chain, an LL-envelope value containing
 * the PEM, or a bare public key. Returns a PEM string that `crypto.publicEncrypt`
 * accepts (a certificate or a public key).
 *
 * Per the spec the leaf (last) certificate in the chain carries the key used for
 * the session-key exchange.
 */
export function extractPublicKeyPem(response: string): string {
  // The response may arrive raw (real newlines) or JSON-wrapped over the
  // WebSocket (escaped "\n"). Normalise escaped newlines so the extracted PEM is
  // valid for crypto.publicEncrypt either way.
  const normalized = response.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
  const certs = normalized.match(CERT_BLOCK);
  if (certs && certs.length > 0) {
    return certs[certs.length - 1]!;
  }
  const keys = normalized.match(PUBKEY_BLOCK);
  if (keys && keys.length > 0) {
    return keys[keys.length - 1]!;
  }
  throw new LoxoneAuthenticationError('No certificate or public key found in the Miniserver response');
}
