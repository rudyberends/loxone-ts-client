/** Lifecycle states of the {@link ../LoxoneClient.LoxoneClient}. */
export enum ClientState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Authenticating = 'authenticating',
  Ready = 'ready',
  Reconnecting = 'reconnecting',
  Disconnecting = 'disconnecting',
  Error = 'error',
}
