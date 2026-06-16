import { IntercomControl as GeneratedIntercomControl } from './generated/IntercomControl.js';

/**
 * The secured video/audio connection details returned by an intercom's
 * `securedDetails` command (camera stream URL + credentials). Shapes vary by
 * firmware, so fields are optional.
 */
export interface IntercomSecuredDetails {
  videoInfo?: { streamUrl?: string; user?: string; pass?: string; alertImage?: string; [key: string]: unknown };
  audioInfo?: { host?: string; user?: string; pass?: string; [key: string]: unknown };
  [key: string]: unknown;
}

/** Issues the `securedDetails` command on a control handle and parses the result. */
export async function fetchIntercomSecuredDetails(
  handle: { send(command: string): Promise<{ value: unknown }> },
): Promise<IntercomSecuredDetails | undefined> {
  const response = await handle.send('securedDetails');
  const value = response.value;
  if (value && typeof value === 'object') return value as IntercomSecuredDetails;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as IntercomSecuredDetails;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * A `Intercom` (door controller) — the generated wrapper plus the `securedDetails`
 * command, which returns the camera stream URL and credentials as a typed object
 * instead of a raw JSON string.
 */
export class IntercomControl extends GeneratedIntercomControl {
  /** Fetches the secured video/audio connection details for this intercom. */
  async securedDetails(): Promise<IntercomSecuredDetails | undefined> {
    return fetchIntercomSecuredDetails(this);
  }
}
