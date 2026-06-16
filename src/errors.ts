/**
 * Error hierarchy for the Loxone client.
 *
 * All errors thrown by this library extend {@link LoxoneError}, so consumers can
 * `catch (e) { if (e instanceof LoxoneError) ... }` and narrow further on the
 * concrete subclass. The library never calls `process.exit`.
 */

/** Base class for every error raised by this library. */
export class LoxoneError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options as ErrorOptions);
    this.name = new.target.name;
  }
}

/** The Miniserver could not be reached, or the WebSocket/HTTP transport failed. */
export class LoxoneConnectionError extends LoxoneError {}

/** Authentication, token acquisition/refresh, or key exchange failed. */
export class LoxoneAuthenticationError extends LoxoneError {}

/** A command was rejected, returned a non-200 code, or did not behave as expected. */
export class LoxoneCommandError extends LoxoneError {
  /** The Loxone/HTTP response code, when available. */
  readonly code?: number;
  /** The command that triggered the error. */
  readonly command?: string;
  /**
   * Coarse cause, so callers can react without parsing codes:
   * - `comms` — no/!ok transport (timeout, socket); the command may not have run.
   * - `unauthorized` — rejected for auth reasons (wrong/absent visu password, not permitted).
   * - `locked` — the control is locked (visu/logic) and refused the command.
   * - `rejected` — the Miniserver ran the command but returned a non-200 code.
   */
  readonly kind: LoxoneCommandErrorKind;

  constructor(
    message: string,
    options?: { cause?: unknown; code?: number; command?: string; kind?: LoxoneCommandErrorKind },
  ) {
    super(message, options);
    if (options?.code !== undefined) this.code = options.code;
    if (options?.command !== undefined) this.command = options.command;
    this.kind = options?.kind ?? 'rejected';
  }
}

/** Discriminates why a {@link LoxoneCommandError} was raised; see its `kind` field. */
export type LoxoneCommandErrorKind = 'comms' | 'unauthorized' | 'locked' | 'rejected';

/** A command did not receive a response within the configured timeout. */
export class LoxoneTimeoutError extends LoxoneCommandError {
  constructor(message: string, options?: { cause?: unknown; code?: number; command?: string }) {
    super(message, { ...options, kind: 'comms' });
  }
}

/** The Miniserver firmware version is below the supported minimum. */
export class LoxoneUnsupportedVersionError extends LoxoneError {
  readonly version: string;
  constructor(version: string, minimum: string) {
    super(`Unsupported Loxone firmware version ${version}; minimum supported is ${minimum}`);
    this.version = version;
  }
}

/** A binary or text message from the Miniserver could not be parsed. */
export class LoxoneProtocolError extends LoxoneError {}

/** The client was used in a state that does not permit the requested operation. */
export class LoxoneStateError extends LoxoneError {}
