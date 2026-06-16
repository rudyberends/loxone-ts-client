import { LoxoneCommandError, LoxoneConnectionError, LoxoneProtocolError, LoxoneTimeoutError } from '../errors.js';
import type { Logger } from '../logging/Logger.js';
import { DaytimerEvent } from '../protocol/events/DaytimerEvent.js';
import { parseEventTable } from '../protocol/events/parseEventTable.js';
import { TextEvent } from '../protocol/events/TextEvent.js';
import { ValueEvent } from '../protocol/events/ValueEvent.js';
import { WeatherEvent } from '../protocol/events/WeatherEvent.js';
import { FileMessage } from '../protocol/messages/FileMessage.js';
import { MessageHeader } from '../protocol/messages/MessageHeader.js';
import { MessageType } from '../protocol/messages/MessageType.js';
import { TextMessage } from '../protocol/messages/TextMessage.js';
import { TypedEventEmitter } from '../utils/TypedEventEmitter.js';

/** Transforms a plaintext command into the encrypted wire form (`jdev/sys/enc/...`). */
export type Encryptor = (command: string) => string;

/** Events emitted by the {@link WebSocketConnection}. */
export interface WebSocketConnectionEvents {
  connected: () => void;
  disconnected: (reason: string) => void;
  error: (error: Error) => void;
  header: (header: MessageHeader) => void;
  keepalive: () => void;
  /** Out-of-service indicator (firmware update); the connection will close. */
  outOfService: () => void;
  /** A text message not matched to a pending command. */
  textMessage: (message: TextMessage) => void;
  /** A file not matched to a pending command. */
  fileMessage: (message: FileMessage) => void;
  eventTableValues: (events: ValueEvent[]) => void;
  eventTableText: (events: TextEvent[]) => void;
  eventTableDaytimer: (events: DaytimerEvent[]) => void;
  eventTableWeather: (events: WeatherEvent[]) => void;
}

interface PendingCommand {
  kind: 'text' | 'file' | 'keepalive';
  /** Human-readable command (or requested filename). */
  command: string;
  /** Exact string sent over the wire (may be the encrypted form). */
  wire: string;
  resolve: (value: TextMessage | FileMessage | void) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const WS_PATH = '/ws/rfc6455';
const WS_SUBPROTOCOL = 'remotecontrol';

/**
 * Manages the raw RFC6455 WebSocket to the Miniserver: connection lifecycle, the
 * binary header/payload framing state machine, the request/response command
 * queue, and keepalive. It is intentionally unaware of authentication — command
 * encryption is supplied via {@link setEncryptor}.
 */
export class WebSocketConnection extends TypedEventEmitter<WebSocketConnectionEvents> {
  private ws: WebSocket | undefined;
  /** Removes all socket listeners at once on teardown (replaces ws's removeAllListeners). */
  private wsListeners: AbortController | undefined;
  private encryptor: Encryptor | undefined;
  private readonly pending: PendingCommand[] = [];

  /** Header awaiting its payload frame, or null when the next frame is a header. */
  private expectedPayload: MessageType | null = null;
  private lastFileRequested = '';

  private keepAliveTimer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly host: string,
    private readonly useTls: boolean,
    private readonly log: Logger,
    private readonly commandTimeoutMs: number,
  ) {
    super();
  }

  /** True while the socket is open. */
  get isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /** Supplies the function used to encrypt commands before sending. */
  setEncryptor(encryptor: Encryptor | undefined): void {
    this.encryptor = encryptor;
  }

  /** Opens the WebSocket and resolves once it is connected. */
  connect(): Promise<void> {
    const protocol = this.useTls ? 'wss' : 'ws';
    const url = `${protocol}://${this.host}${WS_PATH}`;
    this.log.debug(`Opening WebSocket to ${url}`);

    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url, WS_SUBPROTOCOL);
      ws.binaryType = 'arraybuffer'; // deliver binary frames as ArrayBuffer, not Blob
      this.ws = ws;

      const onOpenError = (event: Event): void => {
        ws.removeEventListener('open', onOpen);
        reject(new LoxoneConnectionError(`Failed to open WebSocket: ${wsErrorMessage(event)}`));
      };
      const onOpen = (): void => {
        ws.removeEventListener('error', onOpenError);
        this.attachHandlers(ws);
        this.emit('connected');
        resolve();
      };
      ws.addEventListener('open', onOpen, { once: true });
      ws.addEventListener('error', onOpenError, { once: true });
    });
  }

  private attachHandlers(ws: WebSocket): void {
    const controller = new AbortController();
    this.wsListeners = controller;
    const { signal } = controller;

    ws.addEventListener(
      'message',
      (event: MessageEvent) => {
        try {
          const data = event.data as string | ArrayBuffer;
          this.handleMessage(data, typeof data !== 'string');
        } catch (error) {
          this.log.error(`Error handling WebSocket message: ${(error as Error).message}`);
          this.emit('error', error as Error);
        }
      },
      { signal },
    );
    ws.addEventListener(
      'close',
      (event) => {
        this.teardown(`WebSocket closed (code ${event.code}${event.reason ? `, ${event.reason}` : ''})`);
      },
      { signal },
    );
    ws.addEventListener(
      'error',
      (event: Event) => {
        const message = wsErrorMessage(event);
        this.emit('error', new LoxoneConnectionError(`WebSocket error: ${message}`));
        this.teardown(`WebSocket error: ${message}`);
      },
      { signal },
    );
  }

  // --- framing ------------------------------------------------------------

  private handleMessage(data: string | ArrayBuffer, isBinary: boolean): void {
    const buffer = toBuffer(data);

    if (this.expectedPayload === null) {
      // We expect a header.
      if (!isBinary) {
        // Stray text frame with no preceding header; surface it but don't desync.
        this.log.warn('Received unexpected text frame while awaiting a header');
        this.deliverText(new TextMessage(buffer.toString('utf8')));
        return;
      }
      const header = MessageHeader.parse(buffer);
      this.log.trace(`recv ${header.toString()}`);
      this.emit('header', header);

      if (header.messageType === MessageType.Keepalive) {
        this.resolveKeepalive();
        return; // no payload follows
      }
      if (header.messageType === MessageType.OutOfService) {
        this.emit('outOfService');
        return; // no payload; connection will close
      }
      if (header.estimated) {
        // An estimated header is always followed by an exact header.
        return;
      }
      this.expectedPayload = header.messageType;
      return;
    }

    // We expect the payload for the previously received header.
    const payloadType = this.expectedPayload;
    this.expectedPayload = null;
    this.dispatchPayload(payloadType, buffer, isBinary);
  }

  private dispatchPayload(type: MessageType, buffer: Buffer, isBinary: boolean): void {
    switch (type) {
      case MessageType.Text:
        this.deliverText(new TextMessage(buffer.toString('utf8')));
        return;
      case MessageType.BinaryFile:
        this.deliverFile(new FileMessage(this.lastFileRequested, buffer, isBinary));
        return;
      case MessageType.EventTableValues:
        this.emit('eventTableValues', parseEventTable(ValueEvent.parse, buffer));
        return;
      case MessageType.EventTableText:
        this.emit('eventTableText', parseEventTable(TextEvent.parse, buffer));
        return;
      case MessageType.EventTableDaytimer:
        this.emit('eventTableDaytimer', parseEventTable(DaytimerEvent.parse, buffer));
        return;
      case MessageType.EventTableWeather:
        this.emit('eventTableWeather', parseEventTable(WeatherEvent.parse, buffer));
        return;
      case MessageType.Keepalive:
      case MessageType.OutOfService:
        // Handled at header stage; no payload expected.
        return;
      default:
        throw new LoxoneProtocolError(`Unhandled payload type ${type}`);
    }
  }

  // --- response routing ---------------------------------------------------

  private deliverText(message: TextMessage): void {
    this.log.trace(`recv text: ${message.raw.slice(0, 300)}`);
    const entry = this.matchTextCommand(message.control);
    if (entry) {
      this.settle(entry, message);
    } else {
      this.emit('textMessage', message);
    }
  }

  private deliverFile(message: FileMessage): void {
    const entry = this.takeFirst('file');
    if (entry) {
      this.settle(entry, message);
    } else {
      this.emit('fileMessage', message);
    }
  }

  private resolveKeepalive(): void {
    const entry = this.takeFirst('keepalive');
    if (entry) this.settle(entry);
    this.emit('keepalive');
  }

  /** Finds a pending text command matching the response control, else FIFO. */
  private matchTextCommand(control: string | undefined): PendingCommand | undefined {
    if (control) {
      const idx = this.pending.findIndex(
        (p) => p.kind === 'text' && (matchesControl(p.wire, control) || matchesControl(p.command, control)),
      );
      if (idx !== -1) return this.pending.splice(idx, 1)[0];
    }
    // Fallback: responses on a single socket are ordered, so resolve the oldest.
    return this.takeFirst('text');
  }

  private takeFirst(kind: PendingCommand['kind']): PendingCommand | undefined {
    const idx = this.pending.findIndex((p) => p.kind === kind);
    return idx === -1 ? undefined : this.pending.splice(idx, 1)[0];
  }

  private settle(entry: PendingCommand, value?: TextMessage | FileMessage): void {
    clearTimeout(entry.timer);
    entry.resolve(value);
  }

  // --- sending ------------------------------------------------------------

  /** Sends a text command and resolves with the response. */
  sendCommand(command: string, options: { encrypt?: boolean; timeoutMs?: number } = {}): Promise<TextMessage> {
    const encrypt = options.encrypt ?? false;
    let wire = command;
    if (encrypt) {
      if (!this.encryptor)
        throw new LoxoneCommandError('Encryption requested but no encryptor is configured', { command });
      wire = this.encryptor(command);
    }
    return this.enqueue('text', command, wire, options.timeoutMs) as Promise<TextMessage>;
  }

  /** Requests a file (e.g. `data/LoxAPP3.json`) and resolves with its content. */
  sendFileCommand(filename: string, options: { timeoutMs?: number } = {}): Promise<FileMessage> {
    this.lastFileRequested = filename;
    return this.enqueue('file', filename, filename, options.timeoutMs) as Promise<FileMessage>;
  }

  /** Sends a keepalive and resolves when the Miniserver acknowledges it. */
  sendKeepalive(timeoutMs?: number): Promise<void> {
    return this.enqueue('keepalive', 'keepalive', 'keepalive', timeoutMs) as Promise<void>;
  }

  private enqueue(
    kind: PendingCommand['kind'],
    command: string,
    wire: string,
    timeoutMs = this.commandTimeoutMs,
  ): Promise<TextMessage | FileMessage | void> {
    if (!this.isOpen) {
      return Promise.reject(new LoxoneConnectionError('Cannot send command: WebSocket is not open'));
    }
    return new Promise<TextMessage | FileMessage | void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.pending.findIndex((p) => p.timer === timer);
        if (idx !== -1) this.pending.splice(idx, 1);
        reject(new LoxoneTimeoutError(`No response for "${command}" after ${timeoutMs}ms`, { command }));
      }, timeoutMs);
      if (typeof timer.unref === 'function') timer.unref();

      this.pending.push({ kind, command, wire, resolve, reject, timer });
      try {
        this.log.trace(`send ${kind}: ${command === wire ? command : `${command} (encrypted)`}`);
        this.ws!.send(wire);
      } catch (error) {
        const idx = this.pending.findIndex((p) => p.timer === timer);
        if (idx !== -1) this.pending.splice(idx, 1);
        clearTimeout(timer);
        reject(new LoxoneConnectionError(`Failed to send "${command}"`, { cause: error }));
      }
    });
  }

  // --- keepalive ----------------------------------------------------------

  /** Starts periodic keepalives; tears down the connection if one fails. */
  startKeepAlive(intervalMs: number, timeoutMs: number): void {
    this.stopKeepAlive();
    this.keepAliveTimer = setInterval(() => {
      if (!this.isOpen) return;
      this.sendKeepalive(timeoutMs).catch((error: Error) => {
        this.log.error(`Keepalive failed: ${error.message}`);
        this.teardown('Keepalive failed or timed out');
      });
    }, intervalMs);
    if (typeof this.keepAliveTimer.unref === 'function') this.keepAliveTimer.unref();
  }

  private stopKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = undefined;
    }
  }

  // --- shutdown -----------------------------------------------------------

  /** Closes the socket and rejects all pending commands. */
  close(reason = 'Closed by client'): void {
    this.teardown(reason);
  }

  private teardown(reason: string): void {
    this.stopKeepAlive();

    const error = new LoxoneConnectionError(`Connection closed: ${reason}`);
    for (const entry of this.pending.splice(0)) {
      clearTimeout(entry.timer);
      entry.reject(error);
    }

    const ws = this.ws;
    this.ws = undefined;
    this.expectedPayload = null;
    this.wsListeners?.abort(); // detach all socket listeners
    this.wsListeners = undefined;
    if (ws) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      this.emit('disconnected', reason);
    }
  }
}

function toBuffer(data: string | ArrayBuffer | Buffer): Buffer {
  if (typeof data === 'string') return Buffer.from(data, 'utf8');
  if (Buffer.isBuffer(data)) return data;
  return Buffer.from(data); // ArrayBuffer
}

/** Best-effort message from a WebSocket `error` Event (undici exposes an ErrorEvent with `error`/`message`). */
function wsErrorMessage(event: Event): string {
  const e = event as { message?: unknown; error?: { message?: unknown } };
  if (typeof e.message === 'string' && e.message) return e.message;
  if (e.error && typeof e.error.message === 'string') return e.error.message;
  return 'connection error';
}

/** Compares a sent command/wire string against a response control, tolerant of URL-encoding and the jdev/dev prefix. */
function matchesControl(sent: string, control: string): boolean {
  const candidates = new Set<string>([sent]);
  try {
    candidates.add(decodeURIComponent(sent));
  } catch {
    // ignore malformed encoding
  }
  for (const candidate of [...candidates]) {
    candidates.add(candidate.replace(/^jdev\//, 'dev/'));
  }
  return candidates.has(control);
}
