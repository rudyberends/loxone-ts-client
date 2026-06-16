/**
 * Identifier byte (2nd byte) of a binary {@link MessageHeader}, telling the
 * client what kind of payload follows. Values match the protocol spec.
 */
export enum MessageType {
  /** Text message (command responses, structure file, XML/JSON files). */
  Text = 0,
  /** Binary file (images, statistics, ...). */
  BinaryFile = 1,
  /** Event table of value-states (UUID + double). */
  EventTableValues = 2,
  /** Event table of text-states. */
  EventTableText = 3,
  /** Event table of daytimer-states. */
  EventTableDaytimer = 4,
  /** Out-of-service indicator (e.g. firmware update); connection will close. No payload follows. */
  OutOfService = 5,
  /** Keepalive response (sent by the Miniserver after a `keepalive` command). No payload follows. */
  Keepalive = 6,
  /** Event table of weather-states. */
  EventTableWeather = 7,
}

/** Returns true if `value` is a known {@link MessageType}. */
export function isKnownMessageType(value: number): value is MessageType {
  return value in MessageType;
}
