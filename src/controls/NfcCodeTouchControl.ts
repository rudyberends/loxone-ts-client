import { NfcCodeTouchControl as GeneratedNfcCodeTouchControl } from './generated/NfcCodeTouchControl.js';

/**
 * The `type` of an NFC Code Touch history entry (Structure File, NFC Code Touch →
 * `history`): how the access was attempted and whether it was granted.
 */
export const NfcHistoryType = {
  /** Code, can be associated with one user. */
  Code: 0,
  /** Code with a name. */
  NamedCode: 1,
  /** Code used by multiple users (ambiguous). */
  AmbiguousCode: 2,
  /** NFC tag, can be associated with one user. */
  Nfc: 3,
  /** NFC tag with a name. */
  NamedNfc: 4,
  /** NFC tag used by multiple users (ambiguous). */
  AmbiguousNfc: 5,
  /** Via the app. */
  App: 6,
  DeniedCode: 7,
  DeniedNfc: 8,
  DeniedApp: 9,
  /** Allowed by an external authority (since V15.1). */
  AllowedExternal: 10,
  /** Denied by an external authority (since V15.1). */
  DeniedExternal: 11,
  KeycodeDisabled: 12,
  NfcDisabled: 13,
} as const;

/** One entry of the NFC Code Touch access history. */
export interface NfcHistoryEntry {
  /** Unix timestamp (UTC). */
  ts: number;
  /**
   * The output that was triggered: 1-6 normally (1-9999 with additional
   * preselection), 0 for the first factor of two-factor auth, -1 for denied access.
   */
  output: number;
  /** How access was attempted; see {@link NfcHistoryType}. */
  type: number;
  /** Name of the user (types 0, 3, 6, 10, 11), or the trust member name. */
  user?: string;
  /** Name of the code (type 1) or tag (types 3, 4). */
  description?: string;
  /** External medium, e.g. "Card", "OCPP-ID" or "NFC Tag" (types 10, 11). */
  extMedium?: string;
  /** External authority, e.g. "Server" (types 10, 11). */
  extAuthority?: string;
}

const GRANTED_TYPES: ReadonlySet<number> = new Set([0, 1, 2, 3, 4, 5, 6, 10]);

/**
 * True when the entry records access that was granted (a valid code, NFC tag,
 * app or external authorisation that triggered an output). The first factor of
 * a two-factor authentication (`output` 0) is not yet a granted access.
 */
export function isNfcAccessGranted(entry: NfcHistoryEntry): boolean {
  return GRANTED_TYPES.has(entry.type) && entry.output > 0;
}

const DENIED_TYPES: ReadonlySet<number> = new Set([7, 8, 9, 11, 12, 13]);

/**
 * True when the entry records a refused attempt: a denied code, NFC tag, app or
 * external authorisation, a disabled keycode/tag, or `output` -1 (denied access).
 * Neither this nor {@link isNfcAccessGranted} holds for a 2FA first factor.
 */
export function isNfcAccessDenied(entry: NfcHistoryEntry): boolean {
  return DENIED_TYPES.has(entry.type) || entry.output === -1;
}

/** Normalises a `history` response into typed entries, dropping malformed rows. */
export function parseNfcHistory(value: unknown): NfcHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (e): e is NfcHistoryEntry =>
        !!e && typeof e === 'object' && typeof e.ts === 'number' && typeof e.type === 'number',
    )
    .map((e) => ({ ...e, output: typeof e.output === 'number' ? e.output : Number(e.output) }));
}

/**
 * An `NfcCodeTouch` — the generated wrapper with the `history` command typed:
 * it resolves to the parsed access history instead of a raw JSON value, so a
 * consumer reacting to `historyDate` can tell a granted unlock from a denied
 * attempt.
 */
export class NfcCodeTouchControl extends GeneratedNfcCodeTouchControl {
  /** Fetches the access history (oldest-to-newest as delivered by the Miniserver). */
  override async history(): Promise<NfcHistoryEntry[]> {
    return parseNfcHistory(await super.history());
  }

  /** The most recent history entry (highest `ts`), or `undefined` if there is none. */
  async latestHistoryEntry(): Promise<NfcHistoryEntry | undefined> {
    const entries = await this.history();
    return entries.reduce<NfcHistoryEntry | undefined>(
      (latest, e) => (!latest || e.ts >= latest.ts ? e : latest),
      undefined,
    );
  }
}
