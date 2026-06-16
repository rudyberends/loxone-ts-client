import { LoxoneProtocolError } from '../../errors.js';
import type { EventParser, LoxoneEvent } from './LoxoneEvent.js';

/**
 * Parses a binary event table into a list of events. A single table may contain
 * many events; each parsed event reports its own {@link LoxoneEvent.byteLength}
 * so the reader can advance to the next record.
 */
export function parseEventTable<T extends LoxoneEvent>(parse: EventParser<T>, buffer: Buffer): T[] {
  const events: T[] = [];
  let offset = 0;
  while (offset < buffer.length) {
    let event: T;
    try {
      event = parse(buffer, offset);
    } catch (error) {
      // A truncated or corrupt trailing record (typed as LoxoneProtocolError by
      // the parsers' bounds checks) shouldn't discard the valid events already
      // decoded from this table — stop and return the good prefix. Anything else
      // is an unexpected bug and propagates.
      if (error instanceof LoxoneProtocolError) break;
      throw error;
    }
    const advance = event.byteLength;
    if (advance <= 0) {
      throw new LoxoneProtocolError('Event reported a non-positive byte length; aborting to avoid an infinite loop');
    }
    events.push(event);
    offset += advance;
  }
  return events;
}
