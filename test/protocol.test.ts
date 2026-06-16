import { describe, expect, it } from 'vitest';
import { parseEventTable } from '../src/protocol/events/parseEventTable.js';
import { TextEvent } from '../src/protocol/events/TextEvent.js';
import { ValueEvent } from '../src/protocol/events/ValueEvent.js';
import { MessageHeader } from '../src/protocol/messages/MessageHeader.js';
import { MessageType } from '../src/protocol/messages/MessageType.js';
import { TextMessage } from '../src/protocol/messages/TextMessage.js';
import { Uuid } from '../src/protocol/messages/Uuid.js';

function header(identifier: number, length: number, info = 0): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeUInt8(0x03, 0);
  buf.writeUInt8(identifier, 1);
  buf.writeUInt8(info, 2);
  buf.writeUInt32LE(length, 4);
  return buf;
}

function valueEventBuffer(uuid: string, value: number): Buffer {
  const buf = Buffer.alloc(24);
  Uuid.fromString(uuid).toBuffer().copy(buf, 0);
  buf.writeDoubleLE(value, 16);
  return buf;
}

function textEventBuffer(uuid: string, text: string): Buffer {
  const head = Buffer.alloc(4);
  head.writeUInt32LE(Buffer.byteLength(text), 0);
  const body = Buffer.concat([
    Uuid.fromString(uuid).toBuffer(),
    Uuid.EMPTY.toBuffer(),
    head,
    Buffer.from(text, 'utf8'),
  ]);
  const pad = (4 - (body.length % 4)) % 4;
  return pad ? Buffer.concat([body, Buffer.alloc(pad)]) : body;
}

describe('MessageHeader', () => {
  it('parses each message type with its length', () => {
    const h = MessageHeader.parse(header(MessageType.EventTableValues, 240));
    expect(h.messageType).toBe(MessageType.EventTableValues);
    expect(h.payloadLength).toBe(240);
    expect(h.estimated).toBe(false);
    expect(h.hasPayload).toBe(true);
  });

  it('detects the estimated flag', () => {
    expect(MessageHeader.parse(header(MessageType.Text, 10, 0x80)).estimated).toBe(true);
  });

  it('marks keepalive/out-of-service as payload-less', () => {
    expect(MessageHeader.parse(header(MessageType.Keepalive, 0)).hasPayload).toBe(false);
    expect(MessageHeader.parse(header(MessageType.OutOfService, 0)).hasPayload).toBe(false);
  });

  it('rejects a bad magic byte and unknown identifiers', () => {
    const bad = header(MessageType.Text, 0);
    bad.writeUInt8(0x99, 0);
    expect(() => MessageHeader.parse(bad)).toThrow();
    expect(() => MessageHeader.parse(header(42, 0))).toThrow();
  });
});

describe('ValueEvent + parseEventTable', () => {
  it('parses a single value event (24 bytes)', () => {
    const event = ValueEvent.parse(valueEventBuffer('0f869a02-0367-3105-ffffb2f8baf0a3e6', 21.5), 0);
    expect(event.uuid.value).toBe('0f869a02-0367-3105-ffffb2f8baf0a3e6');
    expect(event.value).toBe(21.5);
    expect(event.byteLength).toBe(24);
  });

  it('parses a table of multiple value events', () => {
    const table = Buffer.concat([
      valueEventBuffer('0f869a02-0367-3105-ffffb2f8baf0a3e6', 1),
      valueEventBuffer('11111111-2222-3333-4444555566667777', -3.25),
    ]);
    const events = parseEventTable(ValueEvent.parse, table);
    expect(events).toHaveLength(2);
    expect(events[0]!.value).toBe(1);
    expect(events[1]!.value).toBe(-3.25);
    expect(events[1]!.uuid.value).toBe('11111111-2222-3333-4444555566667777');
  });
});

describe('TextEvent', () => {
  it('parses text and pads the record to a 4-byte boundary', () => {
    const text = 'hi'; // length 2 -> padded to 4
    const uuid = Uuid.fromString('0f869a02-0367-3105-ffffb2f8baf0a3e6').toBuffer();
    const icon = Uuid.EMPTY.toBuffer();
    const head = Buffer.alloc(4);
    head.writeUInt32LE(text.length, 0);
    const body = Buffer.concat([uuid, icon, head, Buffer.from(text, 'utf8'), Buffer.alloc(2)]);

    const event = TextEvent.parse(body, 0);
    expect(event.text).toBe('hi');
    expect(event.byteLength % 4).toBe(0);
    expect(event.byteLength).toBe(16 + 16 + 4 + 4); // text padded 2 -> 4
  });
});

describe('event enrichment accessors', () => {
  it('ValueEvent exposes booleanValue', () => {
    expect(ValueEvent.parse(valueEventBuffer('0f869a02-0367-3105-ffffb2f8baf0a3e6', 1), 0).booleanValue).toBe(true);
    expect(ValueEvent.parse(valueEventBuffer('0f869a02-0367-3105-ffffb2f8baf0a3e6', 0), 0).booleanValue).toBe(false);
  });

  it('control/room/formatted are undefined until enriched', () => {
    const e = ValueEvent.parse(valueEventBuffer('0f869a02-0367-3105-ffffb2f8baf0a3e6', 5), 0);
    expect(e.control).toBeUndefined();
    expect(e.room).toBeUndefined();
    expect(e.formatted).toBeUndefined();
    expect(e.stateName).toBeUndefined();
  });

  it('TextEvent.json parses JSON text and tolerates plain text', () => {
    const json = textEventBuffer('11111111-2222-3333-4444555566667777', '{"icon":"x.svg","color":"#abc"}');
    expect(TextEvent.parse(json, 0).json<{ icon: string }>()).toEqual({ icon: 'x.svg', color: '#abc' });
    const plain = textEventBuffer('11111111-2222-3333-4444555566667777', 'Standby');
    expect(TextEvent.parse(plain, 0).json()).toBeUndefined();
  });
});

describe('TextMessage', () => {
  it('parses an LL control envelope', () => {
    const msg = new TextMessage(JSON.stringify({ LL: { control: 'jdev/sps/io/x/on', value: '1', Code: '200' } }));
    expect(msg.control).toBe('jdev/sps/io/x/on');
    expect(msg.code).toBe(200);
    expect(msg.ok).toBe(true);
    expect(msg.asString()).toBe('1');
    expect(msg.asNumber()).toBe(1);
  });

  it('reads structured values via asRecord', () => {
    const msg = new TextMessage(
      JSON.stringify({ LL: { control: 'getkey2', value: { key: 'AB', salt: 'cd' }, code: 200 } }),
    );
    expect(msg.asRecord<{ key: string; salt: string }>()).toEqual({ key: 'AB', salt: 'cd' });
  });

  it('falls back to plain text for non-JSON payloads', () => {
    const msg = new TextMessage('<svg></svg>');
    expect(msg.isJson).toBe(false);
    expect(msg.asString()).toBe('<svg></svg>');
  });
});
