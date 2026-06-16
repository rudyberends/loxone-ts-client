/**
 * loxone-ts-client — a fully type-safe TypeScript client for Loxone Miniservers.
 *
 * @packageDocumentation
 */

// Main facade
export { LoxoneClient } from './LoxoneClient.js';
export type { WatchTarget } from './LoxoneClient.js';
export { RoomView, RoomLighting } from './client/RoomView.js';
export type {
  ReadableCapability,
  WritableCapability,
  RoomAudioState,
  RoomAudioCommand,
} from './client/RoomView.js';
export type { LoxoneClientEvents } from './client/ClientEvents.js';
export { ClientState } from './client/ClientState.js';
export type { LoxoneClientOptions } from './client/ClientOptions.js';

// Typed control wrappers
export * from './controls/index.js';

// Errors
export {
  LoxoneError,
  LoxoneConnectionError,
  LoxoneAuthenticationError,
  LoxoneCommandError,
  LoxoneTimeoutError,
  LoxoneUnsupportedVersionError,
  LoxoneProtocolError,
  LoxoneStateError,
} from './errors.js';
export type { LoxoneCommandErrorKind } from './errors.js';

// Logging
export type { Logger, LogLevel } from './logging/Logger.js';
export { NoopLogger, ConsoleLogger } from './logging/Logger.js';

// Authentication
export type { AuthenticatorOptions } from './auth/Authenticator.js';
export { Authenticator } from './auth/Authenticator.js';
export { TokenManager, TokenPermission } from './auth/TokenManager.js';
export type { TokenInfo, TokenManagerOptions } from './auth/TokenManager.js';
export { SecuredCommands } from './auth/SecuredCommands.js';
export { CommandEncryption } from './auth/CommandEncryption.js';
export * from './auth/hashing.js';

// Transport
export { WebSocketConnection } from './transport/WebSocketConnection.js';
export type { WebSocketConnectionEvents, Encryptor } from './transport/WebSocketConnection.js';
export { HttpClient } from './transport/HttpClient.js';
export type { MiniserverApiInfo, FetchLike } from './transport/HttpClient.js';
export { CloudDns, buildTlsHostname, CLOUD_DNS_HOST } from './transport/CloudDns.js';
export {
  discoverMiniservers,
  identifyMiniserver,
  parseLoxLive,
  DISCOVERY_PROBE_PORT,
  DISCOVERY_REPLY_PORT,
  type DiscoveredMiniserver,
  type DiscoveryOptions,
} from './discovery/discovery.js';
export type { CloudDnsResult } from './transport/CloudDns.js';

// Protocol — messages & helpers
export { loxoneEpochToDate, LOXONE_EPOCH_MS } from './protocol/loxoneEpoch.js';
export { Uuid } from './protocol/messages/Uuid.js';
export { MessageHeader } from './protocol/messages/MessageHeader.js';
export { MessageType, isKnownMessageType } from './protocol/messages/MessageType.js';
export { TextMessage } from './protocol/messages/TextMessage.js';
export { FileMessage } from './protocol/messages/FileMessage.js';

// Protocol — events
export { LoxoneEvent } from './protocol/events/LoxoneEvent.js';
export type { EventParser } from './protocol/events/LoxoneEvent.js';
export { ValueEvent } from './protocol/events/ValueEvent.js';
export { TextEvent } from './protocol/events/TextEvent.js';
export { DaytimerEvent } from './protocol/events/DaytimerEvent.js';
export type { DaytimerEntry } from './protocol/events/DaytimerEvent.js';
export { WeatherEvent } from './protocol/events/WeatherEvent.js';
export type { WeatherEntry } from './protocol/events/WeatherEvent.js';
export { parseEventTable } from './protocol/events/parseEventTable.js';

// Structure model
export { StructureModel } from './structure/StructureModel.js';
export { Control } from './structure/Control.js';
export type { LockStatus } from './structure/Control.js';
export { State } from './structure/State.js';
export { Room } from './structure/Room.js';
export { Category } from './structure/Category.js';
export { formatLoxoneValue } from './structure/format.js';
export {
  decodeBinaryStatistics,
  parseStatisticInfo,
  toUnixSeconds,
  type StatisticGroupInfo,
  type StatisticMode,
  type StatisticPoint,
  type StatisticQuery,
  type StatisticUnit,
} from './structure/statistics.js';
export {
  parseControlHistory,
  type ControlHistoryEntry,
  type ControlHistoryTriggerType,
} from './structure/history.js';
export * from './structure/types.js';
