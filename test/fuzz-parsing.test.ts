import { createCipheriv, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CommandEncryption } from '../src/auth/CommandEncryption.js';
import { LoxoneProtocolError } from '../src/errors.js';
import { DaytimerEvent } from '../src/protocol/events/DaytimerEvent.js';
import { parseEventTable } from '../src/protocol/events/parseEventTable.js';
import { TextEvent } from '../src/protocol/events/TextEvent.js';
import { ValueEvent } from '../src/protocol/events/ValueEvent.js';
import { WeatherEvent } from '../src/protocol/events/WeatherEvent.js';
import { MessageHeader } from '../src/protocol/messages/MessageHeader.js';
import { MessageType } from '../src/protocol/messages/MessageType.js';
import { TextMessage } from '../src/protocol/messages/TextMessage.js';
import { Uuid } from '../src/protocol/messages/Uuid.js';
import { StructureModel } from '../src/structure/StructureModel.js';
import type { LoxoneStructureFile } from '../src/structure/types.js';

const UUID = 'cccc0000-0000-0000-0000000000000101';

// --- buffer builders ------------------------------------------------------
function header(type: MessageType, payloadLength: number, info = 0): Buffer {
  const b = Buffer.alloc(MessageHeader.BYTE_LENGTH);
  b.writeUInt8(0x03, 0);
  b.writeUInt8(type, 1);
  b.writeUInt8(info, 2);
  b.writeUInt32LE(payloadLength, 4);
  return b;
}
function valueRec(uuid: string, value: number): Buffer {
  const v = Buffer.alloc(8);
  v.writeDoubleLE(value, 0);
  return Buffer.concat([Uuid.fromString(uuid).toBuffer(), v]);
}
function textRec(uuid: string, text: string): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32LE(Buffer.byteLength(text), 0);
  const body = Buffer.concat([Uuid.fromString(uuid).toBuffer(), Uuid.EMPTY.toBuffer(), len, Buffer.from(text, 'utf8')]);
  const pad = (4 - (body.length % 4)) % 4;
  return pad ? Buffer.concat([body, Buffer.alloc(pad)]) : body;
}
/** Daytimer/Weather header with an arbitrary (possibly corrupt) entry count and no entries. */
function tableHeaderWithCount(uuid: string, headerExtra: number, count: number): Buffer {
  const mid = Buffer.alloc(headerExtra + 4);
  mid.writeInt32LE(count, headerExtra); // count sits right after the fixed header fields
  return Buffer.concat([Uuid.fromString(uuid).toBuffer(), mid]);
}

describe('MessageHeader.parse — malformed headers', () => {
  it('rejects a too-short buffer', () => {
    expect(() => MessageHeader.parse(Buffer.alloc(4))).toThrow(LoxoneProtocolError);
  });
  it('rejects a bad magic byte', () => {
    const b = header(MessageType.Text, 0);
    b.writeUInt8(0x99, 0);
    expect(() => MessageHeader.parse(b)).toThrow(/magic/i);
  });
  it('rejects an unknown identifier', () => {
    const b = header(MessageType.Text, 0);
    b.writeUInt8(0x42, 1);
    expect(() => MessageHeader.parse(b)).toThrow(/identifier/i);
  });
  it('parses a valid header', () => {
    const h = MessageHeader.parse(header(MessageType.EventTableValues, 24));
    expect(h.messageType).toBe(MessageType.EventTableValues);
    expect(h.payloadLength).toBe(24);
  });
});

describe('event parsers — truncated input throws a typed error (never a raw RangeError)', () => {
  it('ValueEvent rejects a record shorter than 24 bytes', () => {
    expect(() => ValueEvent.parse(Buffer.alloc(20), 0)).toThrow(LoxoneProtocolError);
  });
  it('TextEvent rejects a truncated header', () => {
    expect(() => TextEvent.parse(Buffer.alloc(30), 0)).toThrow(LoxoneProtocolError);
  });
  it('TextEvent rejects a textLength that runs past the buffer', () => {
    const len = Buffer.alloc(4);
    len.writeUInt32LE(1000, 0); // claims 1000 bytes of text that aren't there
    const buf = Buffer.concat([Uuid.fromString(UUID).toBuffer(), Uuid.EMPTY.toBuffer(), len]);
    expect(() => TextEvent.parse(buf, 0)).toThrow(/text event payload/);
  });
  it('DaytimerEvent rejects a negative entry count', () => {
    expect(() => DaytimerEvent.parse(tableHeaderWithCount(UUID, 8, -1), 0)).toThrow(LoxoneProtocolError);
  });
  it('DaytimerEvent rejects a huge entry count without allocating', () => {
    // 0x7FFFFFFF * 24 bytes would be ~51 GB — must fail fast, not OOM.
    expect(() => DaytimerEvent.parse(tableHeaderWithCount(UUID, 8, 0x7fffffff), 0)).toThrow(LoxoneProtocolError);
  });
  it('WeatherEvent rejects a huge entry count without allocating', () => {
    expect(() => WeatherEvent.parse(tableHeaderWithCount(UUID, 4, 0x7fffffff), 0)).toThrow(LoxoneProtocolError);
  });
});

describe('parseEventTable — resilient to a corrupt/truncated tail', () => {
  it('keeps the valid prefix and drops a truncated trailing record', () => {
    const buf = Buffer.concat([valueRec(UUID, 1), valueRec(UUID, 2), Buffer.alloc(10) /* short tail */]);
    const events = parseEventTable(ValueEvent.parse, buf);
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.value)).toEqual([1, 2]);
  });
  it('returns an empty list for an all-garbage buffer (no throw)', () => {
    expect(parseEventTable(ValueEvent.parse, Buffer.alloc(7))).toEqual([]);
  });
  it('parses every record of a clean multi-record table', () => {
    const buf = Buffer.concat([textRec(UUID, 'a'), textRec(UUID, 'bb'), textRec(UUID, 'ccc')]);
    const events = parseEventTable(TextEvent.parse, buf);
    expect(events.map((e) => e.text)).toEqual(['a', 'bb', 'ccc']);
  });
  it('does not loop forever on a runaway count (returns the good prefix)', () => {
    // A valid empty daytimer record (count 0) followed by one with a runaway count.
    const buf = Buffer.concat([tableHeaderWithCount(UUID, 8, 0), tableHeaderWithCount(UUID, 8, 0x7fffffff)]);
    const events = parseEventTable(DaytimerEvent.parse, buf);
    expect(events).toHaveLength(1);
    expect(events[0]!.entries).toEqual([]);
  });
});

describe('CommandEncryption.decryptResponse — malformed ciphertext', () => {
  const KEY = randomBytes(32);
  const IV = randomBytes(16);
  const enc = new CommandEncryption({ key: KEY, iv: IV });
  function encryptZeroPadded(text: string): string {
    const cipher = createCipheriv('aes-256-cbc', KEY, IV);
    cipher.setAutoPadding(false);
    const data = Buffer.from(text, 'utf8');
    const pad = (16 - (data.length % 16)) % 16;
    const padded = pad ? Buffer.concat([data, Buffer.alloc(pad)]) : data;
    return Buffer.concat([cipher.update(padded), cipher.final()]).toString('base64');
  }

  it('round-trips a well-formed response', () => {
    expect(enc.decryptResponse(encryptZeroPadded('hello world'))).toBe('hello world');
  });
  it('throws a typed protocol error for a non-block-aligned ciphertext', () => {
    const garbage = Buffer.from([1, 2, 3, 4, 5]).toString('base64'); // 5 bytes — not a 16-byte multiple
    expect(() => enc.decryptResponse(garbage)).toThrow(LoxoneProtocolError);
  });
});

describe('TextMessage — garbage and odd envelopes', () => {
  it('treats non-JSON as a raw string', () => {
    const m = new TextMessage('not json {');
    expect(m.isJson).toBe(false);
    expect(m.asString()).toBe('not json {');
    expect(m.code).toBeUndefined();
  });
  it('handles valid JSON that is not an LL envelope', () => {
    const m = new TextMessage('[1,2,3]');
    expect(m.jsonValue()).toEqual([1, 2, 3]);
  });
  it('jsonValue() parses a double-encoded JSON string value', () => {
    const m = new TextMessage(JSON.stringify({ LL: { value: '[1,2]', Code: '200' } }));
    expect(m.jsonValue()).toEqual([1, 2]);
  });
  it('asRecord()/jsonValue() return an object value directly', () => {
    const m = new TextMessage(JSON.stringify({ LL: { value: { a: 1 }, Code: 200 } }));
    expect(m.asRecord()).toEqual({ a: 1 });
    expect(m.jsonValue()).toEqual({ a: 1 });
  });
});

describe('StructureModel.parse — malformed structures degrade, never throw', () => {
  const malformed = {
    lastModified: 'x',
    msInfo: {},
    rooms: {},
    cats: {},
    controls: {
      a: {
        name: 'A',
        type: 'Switch',
        uuidAction: 'a',
        room: 'ghost-room', // points at a non-existent room
        cat: 'ghost-cat', // points at a non-existent category
        details: null, // not a record
        states: { active: 'not-a-uuid', list: [UUID, 'also-not-a-uuid'] },
      },
      b: {
        name: 'B',
        type: 'Unknown',
        uuidAction: 'b',
        subControls: { c: { name: 'C', type: 'Y', uuidAction: 'c', states: {} } },
      },
    },
  } as unknown as LoxoneStructureFile;

  it('parses without throwing and resolves controls', () => {
    const model = StructureModel.parse(malformed);
    expect(model.getControl('a')).toBeDefined();
    expect(model.getControl('a')!.room).toBeUndefined(); // ghost ref → no room, not a crash
    expect(model.getControl('a')!.details).toEqual({}); // null details normalised
  });
  it('skips non-UUID state values but keeps valid ones', () => {
    const model = StructureModel.parse(malformed);
    const a = model.getControl('a')!;
    expect(a.getState('active')).toBeUndefined(); // "not-a-uuid" skipped
    expect(a.getState('list[0]')).toBeDefined(); // the valid UUID kept
    expect(a.getState('list[1]')).toBeUndefined(); // the invalid one skipped
  });
  it('parses nested sub-controls', () => {
    const model = StructureModel.parse(malformed);
    expect(model.getControl('c')).toBeDefined();
    expect(model.getControl('c')!.parent?.uuid).toBe('b');
  });
  it('parses an empty structure to just the synthetic Unassigned room', () => {
    const model = StructureModel.parse({ lastModified: 'x', msInfo: {}, rooms: {}, cats: {}, controls: {} });
    expect(model.controls.size).toBe(0);
    expect(model.rooms.size).toBe(1);
  });
});
