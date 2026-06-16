import { describe, expect, it } from 'vitest';
import { LoxoneClient } from '../src/LoxoneClient.js';
import { ValueEvent } from '../src/protocol/events/ValueEvent.js';
import { Uuid } from '../src/protocol/messages/Uuid.js';
import { StructureModel } from '../src/structure/StructureModel.js';
import type { LoxoneStructureFile } from '../src/structure/types.js';

const A = 'aaaa0000-0000-0000-0000000000000001';
const B = 'bbbb0000-0000-0000-0000000000000002';

function makeClient(): LoxoneClient {
  return new LoxoneClient('127.0.0.1', 'u', 'p', { autoReconnect: false });
}
function valueBuf(stateUuid: string, value: number): Buffer {
  const buf = Buffer.alloc(24);
  Uuid.fromString(stateUuid).toBuffer().copy(buf, 0);
  buf.writeDoubleLE(value, 16);
  return buf;
}
/** Push a value event onto the client's internal state stream (what the WS dispatch does). */
function pushValue(client: LoxoneClient, stateUuid: string, value: number): void {
  const event = ValueEvent.parse(valueBuf(stateUuid, value), 0);
  (client as unknown as { stream: { emit(e: string, ...a: unknown[]): boolean } }).stream.emit('value', event);
}

describe('subscribe() delivery + disposers', () => {
  it('delivers only the target state, and stops after the disposer', () => {
    const c = makeClient();
    const seen: number[] = [];
    const off = c.subscribe(A, (e) => seen.push('value' in e ? (e.value as number) : 0), { emitCurrent: false });

    pushValue(c, A, 1);
    pushValue(c, B, 99); // different state — must be ignored
    expect(seen).toEqual([1]);

    off();
    pushValue(c, A, 2);
    expect(seen).toEqual([1]); // no delivery after unsubscribe
  });

  it('keeps overlapping subscriptions independent', () => {
    const c = makeClient();
    let one = 0;
    let two = 0;
    const off1 = c.subscribe(A, () => one++, { emitCurrent: false });
    const off2 = c.subscribe(A, () => two++, { emitCurrent: false });

    pushValue(c, A, 1);
    expect([one, two]).toEqual([1, 1]);

    off1();
    pushValue(c, A, 2); // only the second listener remains
    expect([one, two]).toEqual([1, 2]);
    off2();
  });

  it('has an idempotent disposer', () => {
    const c = makeClient();
    let count = 0;
    const off = c.subscribe(A, () => count++, { emitCurrent: false });
    off();
    off(); // second call must be a no-op
    pushValue(c, A, 1);
    expect(count).toBe(0);
  });
});

describe('onAnyChange() — the change-level firehose', () => {
  const POS = 'dddd0000-0000-0000-0000000000000301';
  const FIXTURE: LoxoneStructureFile = {
    lastModified: 'x',
    msInfo: {},
    rooms: { living: { uuid: 'living', name: 'Living Room' } },
    cats: {},
    controls: { d: { name: 'Lamp', type: 'Dimmer', uuidAction: 'd', room: 'living', states: { position: POS } } },
  };

  it('delivers a ControlChange for every known-control state change', () => {
    const c = makeClient();
    (c as unknown as { _structure: StructureModel })._structure = StructureModel.parse(FIXTURE);

    const changes: Array<{ name: string; state: string | undefined; value: number | string }> = [];
    const off = c.onAnyChange((ch) => changes.push({ name: ch.item.name, state: ch.state, value: ch.value }));

    // enrich the event (link state) as the client does before emitting
    const event = ValueEvent.parse(valueBuf(POS, 75), 0);
    event.state = c.structure!.getStateByUuid(POS);
    (c as unknown as { stream: { emit(e: string, ...a: unknown[]): boolean } }).stream.emit('value', event);

    expect(changes).toEqual([{ name: 'Lamp', state: 'position', value: 75 }]);

    // a state not in the structure is skipped (no item)
    (c as unknown as { stream: { emit(e: string, ...a: unknown[]): boolean } }).stream.emit(
      'value',
      ValueEvent.parse(valueBuf(A, 1), 0),
    );
    expect(changes).toHaveLength(1);
    off();
  });
});

describe('explicit connect() rejects on failure regardless of autoReconnect', () => {
  it('rejects when the reachability check fails (autoReconnect on)', async () => {
    const client = new LoxoneClient('127.0.0.1', 'u', 'p', {
      autoReconnect: true,
      fetchImpl: () => Promise.reject(new Error('network down')),
    });
    await expect(client.connect()).rejects.toThrow();
  });
});
