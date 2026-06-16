/**
 * The category of cause behind a {@link ControlHistoryEntry}. The union stays
 * open (`(string & {})`) so newer trigger types still type-check.
 */
export type ControlHistoryTriggerType =
  | 'user'
  | 'control'
  | 'logic'
  | 'automaticRule'
  | 'scene'
  | 'centralGw'
  | 'device'
  | 'generic'
  | (string & {});

/** One entry from a control's block history (`gethistory`). */
export interface ControlHistoryEntry {
  /** The raw entry timestamp, in Unix-UTC seconds. */
  ts: number;
  /** {@link ts} as a `Date`. */
  timestamp: Date;
  /** The action that was performed, e.g. `"Lights off"`. */
  what: string;
  /** Why it was performed, e.g. `"Input off"`; may be empty/absent. */
  trigger: string | undefined;
  /** What happened as a direct result; may be empty. */
  impacts: string[];
  /** The trigger category. */
  triggerType: ControlHistoryTriggerType | undefined;
  /** A UUID identifying the cause (e.g. the acting user), when the type provides one. */
  triggerUuid: string | undefined;
}

/**
 * Parses the JSON array returned by `gethistory` into typed entries. Non-array
 * input yields an empty list; unknown fields are ignored. Timestamps are decoded
 * as Unix-UTC seconds (per the protocol), with the raw `ts` preserved.
 */
export function parseControlHistory(raw: unknown): ControlHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const o = (entry ?? {}) as Record<string, unknown>;
    const ts = typeof o['ts'] === 'number' ? o['ts'] : 0;
    const impacts = o['impacts'];
    return {
      ts,
      timestamp: new Date(ts * 1000),
      what: typeof o['what'] === 'string' ? o['what'] : '',
      trigger: typeof o['trigger'] === 'string' ? o['trigger'] : undefined,
      impacts: Array.isArray(impacts) ? impacts.filter((x): x is string => typeof x === 'string') : [],
      triggerType: typeof o['triggerType'] === 'string' ? o['triggerType'] : undefined,
      triggerUuid: typeof o['triggerUuid'] === 'string' ? o['triggerUuid'] : undefined,
    };
  });
}
