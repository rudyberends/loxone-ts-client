import { describe, expect, it } from 'vitest';
import { LoxoneClient } from '../src/LoxoneClient.js';
import { RoomView } from '../src/client/RoomView.js';
import { DimmerControl } from '../src/controls/DimmerControl.js';
import { IRoomControllerV2Control } from '../src/controls/IRoomControllerV2Control.js';
import { SwitchControl } from '../src/controls/SwitchControl.js';
import { AudioZoneV2Control } from '../src/controls/generated/AudioZoneV2Control.js';
import type { ControlCommandExecutor } from '../src/controls/ControlHandle.js';
import { TextEvent } from '../src/protocol/events/TextEvent.js';
import { ValueEvent } from '../src/protocol/events/ValueEvent.js';
import { TextMessage } from '../src/protocol/messages/TextMessage.js';
import { Uuid } from '../src/protocol/messages/Uuid.js';
import { StructureModel } from '../src/structure/StructureModel.js';
import type { LoxoneStructureFile } from '../src/structure/types.js';

const s = {
  tempActual: 'dddd0000-0000-0000-0000000000000401',
  tempTarget: 'dddd0000-0000-0000-0000000000000402',
  hum: 'dddd0000-0000-0000-0000000000000403',
  lux: 'dddd0000-0000-0000-0000000000000404',
  presence: 'dddd0000-0000-0000-0000000000000405',
  swActive: 'dddd0000-0000-0000-0000000000000406',
  dimPos: 'dddd0000-0000-0000-0000000000000407',
  playState: 'dddd0000-0000-0000-0000000000000408',
  volume: 'dddd0000-0000-0000-0000000000000409',
  tempSensor: 'dddd0000-0000-0000-000000000000040a',
};

const FIXTURE: LoxoneStructureFile = {
  lastModified: 'x',
  msInfo: {},
  rooms: { living: { uuid: 'living', name: 'Living Room' }, closet: { uuid: 'closet', name: 'Closet' } },
  cats: { lights: { uuid: 'lights', name: 'Lights', type: 'lights' } },
  controls: {
    irc: { name: 'Climate', type: 'IRoomControllerV2', uuidAction: 'irc', room: 'living', states: { tempActual: s.tempActual, tempTarget: s.tempTarget } },
    hum: { name: 'Humidity', type: 'InfoOnlyAnalog', uuidAction: 'hum', room: 'living', details: { format: '%.0f %%' }, states: { value: s.hum } },
    lux: { name: 'Lux', type: 'InfoOnlyAnalog', uuidAction: 'lux', room: 'living', details: { format: '%.0f Lx' }, states: { value: s.lux } },
    tmp: { name: 'TempSensor', type: 'InfoOnlyAnalog', uuidAction: 'tmp', room: 'living', details: { format: '%.1f°C' }, states: { value: s.tempSensor } },
    pres: { name: 'Presence', type: 'PresenceDetector', uuidAction: 'pres', room: 'living', states: { active: s.presence } },
    sw: { name: 'Lamp', type: 'Switch', uuidAction: 'sw', room: 'living', cat: 'lights', states: { active: s.swActive } },
    dim: { name: 'Dim', type: 'Dimmer', uuidAction: 'dim', room: 'living', states: { position: s.dimPos } },
    audio: { name: 'Speaker', type: 'AudioZoneV2', uuidAction: 'audio', room: 'living', states: { playState: s.playState, volume: s.volume } },
  },
};

function offlineClient(): LoxoneClient {
  const c = new LoxoneClient('127.0.0.1', 'u', 'p', { autoReconnect: false });
  (c as unknown as { _structure: StructureModel })._structure = StructureModel.parse(FIXTURE);
  return c;
}
function valueBuf(uuid: string, value: number): Buffer {
  const buf = Buffer.alloc(24);
  Uuid.fromString(uuid).toBuffer().copy(buf, 0);
  buf.writeDoubleLE(value, 16);
  return buf;
}
function setValue(c: LoxoneClient, uuid: string, value: number): void {
  const state = c.structure!.getStateByUuid(uuid)!;
  state.latestEvent = ValueEvent.parse(valueBuf(uuid, value), 0);
}
function pushValue(c: LoxoneClient, uuid: string, value: number): void {
  const event = ValueEvent.parse(valueBuf(uuid, value), 0);
  const state = c.structure!.getStateByUuid(uuid)!;
  state.latestEvent = event;
  event.state = state;
  (c as unknown as { stream: { emit(e: string, ...a: unknown[]): boolean } }).stream.emit('value', event);
}

describe('client.rooms / client.room()', () => {
  it('lists rooms and looks one up by name (case-insensitive)', () => {
    const c = offlineClient();
    expect(c.rooms.map((r) => r.name).sort()).toEqual(['Closet', 'Living Room']);
    expect(c.room('living room')?.name).toBe('Living Room');
    expect(c.room('nope')).toBeUndefined();
    expect(c.room('Living Room')).toBe(c.room('Living Room')); // cached
  });
});

describe('RoomView capabilities — read (derived from the room controls)', () => {
  it('derives temperature / humidity / brightness / presence / lighting / audio', () => {
    const c = offlineClient();
    setValue(c, s.tempActual, 21.3);
    setValue(c, s.hum, 57);
    setValue(c, s.lux, 320);
    setValue(c, s.presence, 1);
    setValue(c, s.swActive, 1);
    setValue(c, s.playState, 2);
    setValue(c, s.volume, 35);
    const wk = c.room('Living Room')!;

    setValue(c, s.tempSensor, 99); // a temp sensor in the same room, with a different value
    expect(wk.temperature.get()).toBeCloseTo(21.3); // the thermostat is preferred over the sensor
    expect(wk.temperature.available).toBe(true);
    expect(wk.temperature.source).toBeInstanceOf(IRoomControllerV2Control);
    expect(wk.humidity.get()).toBe(57);
    expect(wk.brightness.get()).toBe(320);
    expect(wk.presence.get()).toBe(true);
    expect(wk.lighting.isOn).toBe(true); // switch is on
    expect(wk.lights.map((l) => l.name).sort()).toEqual(['Dim', 'Lamp']); // individual lamps
    expect(wk.audio.get()).toEqual({ playing: true, volume: 35, power: undefined });
  });

  it('reports unavailable capabilities gracefully', () => {
    const c = offlineClient();
    const closet = c.room('Closet')!;
    expect(closet.items).toHaveLength(0);
    expect(closet.temperature.available).toBe(false);
    expect(closet.temperature.get()).toBeUndefined();
    expect(closet.audio.get()).toBeUndefined();
  });

  it('observes a capability via onChange', () => {
    const c = offlineClient();
    setValue(c, s.tempActual, 20);
    const seen: Array<number | undefined> = [];
    const off = c.room('Living Room')!.temperature.onChange((t) => seen.push(t));
    pushValue(c, s.tempActual, 22.5);
    expect(seen).toEqual([22.5]);
    off();
    pushValue(c, s.tempActual, 19);
    expect(seen).toEqual([22.5]);
  });
});

describe('RoomView lighting — controller with sub-control lamps + moods', () => {
  const ML = 'eeee0000-0000-0000-0000000000000001';
  const AM = 'eeee0000-0000-0000-0000000000000002';
  const P1 = 'eeee0000-0000-0000-0000000000000003';
  const A2 = 'eeee0000-0000-0000-0000000000000004';
  const PM = 'eeee0000-0000-0000-0000000000000005';
  const LFIX: LoxoneStructureFile = {
    lastModified: 'x',
    msInfo: {},
    rooms: { r: { uuid: 'r', name: 'Studio' } },
    cats: {},
    controls: {
      lc: {
        name: 'Lights',
        type: 'LightControllerV2',
        uuidAction: 'lc',
        room: 'r',
        details: { masterValue: 'master' }, // points to the master dimmer sub-control
        states: { moodList: ML, activeMoods: AM },
        subControls: {
          master: { name: 'Master', type: 'Dimmer', uuidAction: 'master', states: { position: PM } },
          sub1: { name: 'Spots', type: 'Dimmer', uuidAction: 'sub1', states: { position: P1 } },
          sub2: { name: 'Wall', type: 'Switch', uuidAction: 'sub2', states: { active: A2 } },
        },
      },
    },
  };

  it('exposes the controller sub-controls as individual lamps, plus moods', () => {
    const c = new LoxoneClient('127.0.0.1', 'u', 'p', { autoReconnect: false });
    (c as unknown as { _structure: StructureModel })._structure = StructureModel.parse(LFIX);
    const studio = c.room('Studio')!;

    // the individual lamps are the sub-controls EXCLUDING the master dimmer
    expect(studio.lights.map((l) => l.name).sort()).toEqual(['Spots', 'Wall']);
    expect(studio.lighting.masters.map((m) => m.name)).toEqual(['Master']);

    // moods (scenes) come from the controller's moodList
    const tb = (uuid: string, text: string): Buffer => {
      const u = Uuid.fromString(uuid).toBuffer();
      const icon = Uuid.EMPTY.toBuffer();
      const len = Buffer.alloc(4);
      len.writeUInt32LE(Buffer.byteLength(text), 0);
      const body = Buffer.concat([u, icon, len, Buffer.from(text, 'utf8')]);
      const pad = (4 - (body.length % 4)) % 4;
      return pad ? Buffer.concat([body, Buffer.alloc(pad)]) : body;
    };
    c.structure!.getStateByUuid(ML)!.latestEvent = TextEvent.parse(tb(ML, JSON.stringify([{ id: 1, name: 'Bright' }, { id: 778, name: 'Uit' }])), 0);
    expect(studio.lighting.moods.map((m) => m.name)).toEqual(['Bright', 'Uit']);

    // isOn before any value is known
    expect(studio.lighting.isOn).toBe(false);
    setValue(c, P1, 60); // an individual lamp at 60%
    expect(studio.lighting.isOn).toBe(true);

    // master brightness drives room brightness (dims all together)
    setValue(c, PM, 70);
    expect(studio.lighting.brightness).toBe(70);
  });
});

describe('RoomView capabilities — write', () => {
  it('routes set() to the right control commands', async () => {
    const model = StructureModel.parse(FIXTURE);
    const sent: string[] = [];
    const exec: ControlCommandExecutor = {
      control: (_t, command) => {
        sent.push(command);
        return Promise.resolve(new TextMessage(JSON.stringify({ LL: { control: 'x', value: '1', Code: '200' } })));
      },
    };
    const handles = [
      new IRoomControllerV2Control(model.getControl('irc')!, exec),
      new SwitchControl(model.getControl('sw')!, exec),
      new DimmerControl(model.getControl('dim')!, exec),
      new AudioZoneV2Control(model.getControl('audio')!, exec),
    ];
    const rv = new RoomView({ itemsInRoom: () => handles, item: () => undefined }, model.rooms.get('living')!);

    await rv.targetTemperature.set(21.5);
    await rv.lighting.on(); // turns the standalone switch + dimmer on
    await rv.audio.set({ playing: true, volume: 30 });

    expect(sent).toContain('setComfortTemperature/21.5');
    expect(sent).toContain('on'); // switch + dimmer turned on
    expect(sent).toContain('play');
    expect(sent).toContain('volume/30');
  });
});
