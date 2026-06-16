import { IntercomV2Control as GeneratedIntercomV2Control } from './generated/IntercomV2Control.js';
import { fetchIntercomSecuredDetails, type IntercomSecuredDetails } from './IntercomControl.js';

/**
 * An `IntercomV2` — the generated wrapper plus the `securedDetails` command,
 * which returns the camera stream URL and credentials as a typed object instead
 * of a raw JSON string.
 */
export class IntercomV2Control extends GeneratedIntercomV2Control {
  /** Fetches the secured video/audio connection details for this intercom. */
  async securedDetails(): Promise<IntercomSecuredDetails | undefined> {
    return fetchIntercomSecuredDetails(this);
  }
}
