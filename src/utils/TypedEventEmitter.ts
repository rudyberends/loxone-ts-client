import { EventEmitter } from 'node:events';

/** Any listener signature. */
export type Listener = (...args: never[]) => void;

/**
 * A thin, fully-typed wrapper around Node's {@link EventEmitter}. Subclass with a
 * concrete event map (an interface whose values are listener functions) to get
 * compile-time-checked `on`/`once`/`off`/`emit`.
 *
 * The self-referential constraint avoids requiring a string index signature, so
 * plain interfaces satisfy it directly.
 */
export class TypedEventEmitter<TEvents extends Record<keyof TEvents, Listener>> {
  private readonly emitter = new EventEmitter();

  on<K extends keyof TEvents>(event: K, listener: TEvents[K]): this {
    this.emitter.on(event as string, listener as unknown as (...args: unknown[]) => void);
    return this;
  }

  once<K extends keyof TEvents>(event: K, listener: TEvents[K]): this {
    this.emitter.once(event as string, listener as unknown as (...args: unknown[]) => void);
    return this;
  }

  off<K extends keyof TEvents>(event: K, listener: TEvents[K]): this {
    this.emitter.off(event as string, listener as unknown as (...args: unknown[]) => void);
    return this;
  }

  removeAllListeners(event?: keyof TEvents): this {
    this.emitter.removeAllListeners(event as string | undefined);
    return this;
  }

  /** Sets the max listeners on the underlying emitter (to silence warnings on busy clients). */
  setMaxListeners(n: number): this {
    this.emitter.setMaxListeners(n);
    return this;
  }

  /** Number of listeners registered for an event. */
  listenerCount(event: keyof TEvents): number {
    return this.emitter.listenerCount(event as string);
  }

  protected emit<K extends keyof TEvents>(event: K, ...args: Parameters<TEvents[K]>): boolean {
    return this.emitter.emit(event as string, ...args);
  }
}
