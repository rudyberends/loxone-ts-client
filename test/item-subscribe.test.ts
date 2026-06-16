import { describe, expect, it } from 'vitest';
import { LoxoneClient } from '../src/LoxoneClient.js';
import { ControlHandle, type ControlChange, type ControlCommandExecutor } from '../src/controls/ControlHandle.js';
import { DimmerControl } from '../src/controls/DimmerControl.js';
import { LoxoneStateError } from '../src/errors.js';
import { ValueEvent } from '../src/protocol/events/ValueEvent.js';
import { TextMessage } from '../src/protocol/messages/TextMessage.js';
import { Uuid } from '../src/protocol/messages/Uuid.js';
import { StructureModel } from '../src/structure/StructureModel.js';
import type { LoxoneStructureFile } from '../src/structure/types.js';

const POS = 'dddd0000-0000-0000-0000000000000201';
const FIXTURE: LoxoneStructureFile = {
  lastModified: 'x',
  msInfo: {},
  rooms: { living: { uuid: 'living', name: 'Living Room' } },
  cats: {},
  controls: {
    dimmer: { name: 'Lamp', type: 'Dimmer', uuidAction: 'dimmer', room: 'living', states: { position: POS } },
  },
};

function offlineClient(): LoxoneClient {
  const c = new LoxoneClient('127.0.0.1', 'u', 'p', { autoReconnect: false });
  (c as unknown as { _structure: StructureModel })._structure = StructureModel.parse(FIXTURE);
  return c;
}

function valueBuf(stateUuid: string, value: number): Buffer {
  const buf = Buffer.alloc(24);
  Uuid.fromString(stateUuid).toBuffer().copy(buf, 0);
  buf.writeDoubleLE(value, 16);
  return buf;
}

/** Simulates a live value update: sets the state's latest event, then emits it. */
function pushValue(client: LoxoneClient, stateUuid: string, value: number): void {
  const event = ValueEvent.parse(valueBuf(stateUuid, value), 0);
  const state = (client as unknown as { _structure: StructureModel })._structure.getStateByUuid(stateUuid)!;
  state.latestEvent = event;
  event.state = state; // enrichment: the client links event→state before emitting
  // value/text flow on the client's internal stream; reach it to simulate a live event.
  (client as unknown as { stream: { emit(e: string, ...a: unknown[]): boolean } }).stream.emit('value', event);
}

describe('item-level subscription (handle.onChange / onState)', () => {
  it('replays the current value, then fires on live changes; the handle reflects them', () => {
    const c = offlineClient();
    const lamp = c.item('dimmer') as DimmerControl;
    pushValue(c, POS, 40); // there is already a value before subscribing

    const changes: ControlChange[] = [];
    const off = lamp.onChange((change) => changes.push(change), { emitCurrent: true });

    expect(changes).toHaveLength(1); // emitCurrent replay
    expect(changes[0]).toMatchObject({ state: 'position', value: 40 });
    expect(changes[0]!.item).toBe(lamp);

    pushValue(c, POS, 80); // a live change
    expect(changes).toHaveLength(2);
    expect(changes[1]!.value).toBe(80);
    expect(lamp.position).toBe(80); // the object itself reflects the new value

    off();
    pushValue(c, POS, 10);
    expect(changes).toHaveLength(2); // no more after unsubscribe
  });

  it('onState observes a single named state and fails loud on a typo', () => {
    const c = offlineClient();
    const lamp = c.item('dimmer') as DimmerControl;
    const seen: number[] = [];
    const off = lamp.onState('position', (ch) => seen.push(ch.value as number), { emitCurrent: false });
    pushValue(c, POS, 55);
    expect(seen).toEqual([55]);
    off();
    expect(() => lamp.onState('nope', () => {})).toThrow(LoxoneStateError);
  });

  it('throws when the handle has no subscription channel (bare executor)', () => {
    const c = offlineClient();
    const exec: ControlCommandExecutor = { control: () => Promise.resolve(new TextMessage('{}')) };
    const bare = new DimmerControl(c.structure!.getControl('dimmer')!, exec);
    expect(bare).toBeInstanceOf(ControlHandle);
    expect(() => bare.onChange(() => {})).toThrow(/subscription channel/);
  });
});
