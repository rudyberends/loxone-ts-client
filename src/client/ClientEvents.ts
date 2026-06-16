import type { TokenInfo } from '../auth/TokenManager.js';
import type { DaytimerEvent } from '../protocol/events/DaytimerEvent.js';
import type { WeatherEvent } from '../protocol/events/WeatherEvent.js';
import type { TextMessage } from '../protocol/messages/TextMessage.js';
import type { ClientState } from './ClientState.js';

/** Strongly-typed event map for {@link ../LoxoneClient.LoxoneClient}. */
export interface LoxoneClientEvents {
  /** The WebSocket connected (before authentication). */
  connected: () => void;
  /** Authentication succeeded and a token is held. */
  authenticated: () => void;
  /** The client is fully ready to send commands. */
  ready: () => void;
  /** The token changed (acquired, refreshed, or auto-refreshed) — persist it to reuse after a restart. */
  tokenChanged: (info: TokenInfo) => void;
  /**
   * Fired after {@link ../LoxoneClient.LoxoneClient.enableUpdates} once the state
   * burst has settled — and again after each successful auto-reconnect re-sync.
   */
  statesSettled: () => void;
  /** The connection was lost or closed. */
  disconnected: (reason: string) => void;
  /** The lifecycle state changed. */
  stateChanged: (state: ClientState) => void;
  /** A non-fatal or fatal error occurred. */
  error: (error: Error) => void;

  // Value/text state updates are not public events — observe them via
  // item.onChange/onState or client.onAnyChange. The two specialised tables below
  // are not covered by those, so they remain available as low-level events.
  /** A daytimer-state update (low-level; not surfaced by onChange/onAnyChange). */
  daytimer: (event: DaytimerEvent) => void;
  /** A weather-state update (low-level; not surfaced by onChange/onAnyChange). */
  weather: (event: WeatherEvent) => void;

  /** A text message from the Miniserver not tied to a specific command. */
  message: (message: TextMessage) => void;
  /** The Miniserver signalled it is going out of service (e.g. firmware update). */
  outOfService: () => void;
}
