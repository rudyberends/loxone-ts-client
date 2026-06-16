import { describe, expect, it } from 'vitest';
import { ColorPickerV2Control } from '../src/controls/ColorPickerV2Control.js';
import type { ControlCommandExecutor } from '../src/controls/ControlHandle.js';
import { GateControl } from '../src/controls/GateControl.js';
import { IRoomControllerV2Control } from '../src/controls/IRoomControllerV2Control.js';
import { InfoOnlyDigitalControl } from '../src/controls/InfoControls.js';
import { CONTROL_WRAPPERS } from '../src/controls/registry.js';
import { WindowControl } from '../src/controls/WindowControl.js';
import { TrackerControl, parseTrackerEntries } from '../src/controls/TrackerControl.js';
import { TextStateControl } from '../src/controls/TextStateControl.js';
import { AlarmControl } from '../src/controls/generated/AlarmControl.js';
import { AlarmChainControl } from '../src/controls/generated/AlarmChainControl.js';
import { GENERATED_ACCESSORS } from '../src/controls/generated/accessors.js';
import { loxoneEpochToDate } from '../src/protocol/loxoneEpoch.js';
import { TextEvent } from '../src/protocol/events/TextEvent.js';
import { ValueEvent } from '../src/protocol/events/ValueEvent.js';
import { TextMessage } from '../src/protocol/messages/TextMessage.js';
import { Uuid } from '../src/protocol/messages/Uuid.js';
import type { Control } from '../src/structure/Control.js';
import { StructureModel } from '../src/structure/StructureModel.js';
import type { LoxoneStructureFile } from '../src/structure/types.js';

const ids = {
  gate: 'cccc0000-0000-0000-0000000000000001',
  window: 'cccc0000-0000-0000-0000000000000002',
  color: 'cccc0000-0000-0000-0000000000000003',
  climate: 'cccc0000-0000-0000-0000000000000004',
  digital: 'cccc0000-0000-0000-0000000000000005',
  alarm: 'cccc0000-0000-0000-0000000000000006',
  alarmChain: 'cccc0000-0000-0000-0000000000000007',
  tracker: 'cccc0000-0000-0000-0000000000000008',
  textState: 'cccc0000-0000-0000-0000000000000009',
};
const st = {
  gatePos: 'dddd0000-0000-0000-0000000000000001',
  colorState: 'dddd0000-0000-0000-0000000000000003',
  climateTemp: 'dddd0000-0000-0000-0000000000000004',
  digitalActive: 'dddd0000-0000-0000-0000000000000005',
  alarmNextAt: 'dddd0000-0000-0000-0000000000000007',
  alarmLevel: 'dddd0000-0000-0000-000000000000000b',
  alarmActiveType: 'dddd0000-0000-0000-000000000000000c',
  alarmActiveText: 'dddd0000-0000-0000-000000000000000d',
  trackerEntries: 'dddd0000-0000-0000-0000000000000008',
  textAndIcon: 'dddd0000-0000-0000-0000000000000009',
  iconAndColor: 'dddd0000-0000-0000-000000000000000a',
};

const FIXTURE: LoxoneStructureFile = {
  lastModified: 'x',
  msInfo: {},
  rooms: {},
  cats: {},
  controls: {
    [ids.gate]: { name: 'Garage', type: 'Gate', uuidAction: ids.gate, states: { position: st.gatePos } },
    [ids.window]: { name: 'Velux', type: 'Window', uuidAction: ids.window, states: {} },
    [ids.color]: { name: 'RGB', type: 'ColorPickerV2', uuidAction: ids.color, states: { color: st.colorState } },
    [ids.climate]: { name: 'Room', type: 'IRoomControllerV2', uuidAction: ids.climate, states: { tempActual: st.climateTemp } },
    [ids.digital]: {
      name: 'Door',
      type: 'InfoOnlyDigital',
      uuidAction: ids.digital,
      details: { text: { on: 'Open', off: 'Closed' } },
      states: { active: st.digitalActive },
    },
    [ids.alarm]: { name: 'House', type: 'Alarm', uuidAction: ids.alarm, states: { level: st.alarmLevel } },
    [ids.alarmChain]: {
      name: 'Chain',
      type: 'AlarmChain',
      uuidAction: ids.alarmChain,
      states: { nextAlarmLevelAt: st.alarmNextAt, activeAlarmType: st.alarmActiveType, activeAlarmText: st.alarmActiveText },
    },
    [ids.tracker]: { name: 'Log', type: 'Tracker', uuidAction: ids.tracker, states: { entries: st.trackerEntries } },
    [ids.textState]: {
      name: 'Status',
      type: 'TextState',
      uuidAction: ids.textState,
      states: { textAndIcon: st.textAndIcon, iconAndColor: st.iconAndColor },
    },
  },
};

function recorder(): { exec: ControlCommandExecutor; sent: string[] } {
  const sent: string[] = [];
  return {
    sent,
    exec: {
      control: (_t, command) => {
        sent.push(command);
        return Promise.resolve(new TextMessage(JSON.stringify({ LL: { control: 'x', value: '1', Code: '200' } })));
      },
    },
  };
}

const model = StructureModel.parse(FIXTURE);
const ctrl = (uuid: string): Control => model.getControl(uuid)!;
function valueBuf(stateUuid: string, value: number): Buffer {
  const buf = Buffer.alloc(24);
  Uuid.fromString(stateUuid).toBuffer().copy(buf, 0);
  buf.writeDoubleLE(value, 16);
  return buf;
}

describe('GateControl', () => {
  it('emits documented commands and converts position', async () => {
    const { exec, sent } = recorder();
    const gate = new GateControl(ctrl(ids.gate), exec);
    await gate.open();
    await gate.close();
    await gate.partiallyOpen();
    expect(sent).toEqual(['open', 'close', 'PartiallyOpen']);
    gate.state('position')!.latestEvent = ValueEvent.parse(valueBuf(st.gatePos, 1), 0);
    expect(gate.positionPercent).toBe(100);
    expect(gate.isOpen).toBe(true);
  });
});

describe('WindowControl', () => {
  it('clamps moveToPosition', async () => {
    const { exec, sent } = recorder();
    const w = new WindowControl(ctrl(ids.window), exec);
    await w.setPosition(120);
    await w.fullClose();
    expect(sent).toEqual(['moveToPosition/100', 'fullclose']);
  });
});

describe('ColorPickerV2Control', () => {
  it('builds hsv/temp commands and parses the color state', async () => {
    const { exec, sent } = recorder();
    const cp = new ColorPickerV2Control(ctrl(ids.color), exec);
    await cp.setRgb(120, 100, 80);
    await cp.setTemperature(50, 4000);
    expect(sent).toEqual(['hsv(120,100,80)', 'temp(50,4000)']);
    cp.state('color')!.latestEvent = TextEvent.parse(textBuf(st.colorState, 'hsv(10,20,30)'), 0);
    expect(cp.color).toEqual({ kind: 'hsv', hue: 10, saturation: 20, brightness: 30 });
  });
});

describe('IRoomControllerV2Control', () => {
  it('emits climate commands and reads temperature', async () => {
    const { exec, sent } = recorder();
    const rc = new IRoomControllerV2Control(ctrl(ids.climate), exec);
    await rc.setComfortTemperature(21.5);
    await rc.setOperatingMode(1);
    await rc.override(1, 1000, 22);
    await rc.override(2); // mode only
    await rc.override(1, undefined, 22); // temp without until must keep temp in the 3rd segment
    expect(sent).toEqual([
      'setComfortTemperature/21.5',
      'setOperatingMode/1',
      'override/1/1000/22',
      'override/2',
      'override/1//22',
    ]);
    rc.state('tempActual')!.latestEvent = ValueEvent.parse(valueBuf(st.climateTemp, 19.8), 0);
    expect(rc.temperature).toBeCloseTo(19.8);
  });
});

describe('InfoOnlyDigitalControl', () => {
  it('reads the configured on/off label', () => {
    const d = new InfoOnlyDigitalControl(ctrl(ids.digital), recorder().exec);
    d.state('active')!.latestEvent = ValueEvent.parse(valueBuf(st.digitalActive, 1), 0);
    expect(d.isActive).toBe(true);
    expect(d.label).toBe('Open');
  });
});

describe('generated wrappers: boolean params + Date getters', () => {
  it('serializes clamp(0,1) command params as booleans', async () => {
    const { exec, sent } = recorder();
    const alarm = new AlarmControl(ctrl(ids.alarm), exec);
    await alarm.on();
    await alarm.onWithMovement(true);
    await alarm.onWithMovement(false);
    await alarm.dismv(true);
    expect(sent).toEqual(['on', 'on/1', 'on/0', 'dismv/1']);
  });

  it('pairs a "since 2009" state with a Date getter', () => {
    const chain = new AlarmChainControl(ctrl(ids.alarmChain), recorder().exec);
    chain.state('nextAlarmLevelAt')!.latestEvent = ValueEvent.parse(valueBuf(st.alarmNextAt, 1000), 0);
    expect(chain.nextAlarmLevelAt).toBe(1000);
    expect(chain.nextAlarmLevelDate).toEqual(loxoneEpochToDate(1000));
  });

  it('treats <= 0 epoch values as "no timer" (undefined Date)', () => {
    const chain = new AlarmChainControl(ctrl(ids.alarmChain), recorder().exec);
    chain.state('nextAlarmLevelAt')!.latestEvent = ValueEvent.parse(valueBuf(st.alarmNextAt, 0), 0);
    expect(chain.nextAlarmLevelAt).toBe(0); // raw value still exposed
    expect(chain.nextAlarmLevelDate).toBeUndefined(); // but not a bogus 2009 date
  });

  it('decodes a documented enum state into a typed label (raw still exposed)', () => {
    const alarm = new AlarmControl(ctrl(ids.alarm), recorder().exec);
    alarm.state('level')!.latestEvent = ValueEvent.parse(valueBuf(st.alarmLevel, 3), 0);
    expect(alarm.level).toBe(3); // raw code
    expect(alarm.levelLabel).toBe('Optical'); // decoded
    // an out-of-range code yields undefined rather than a wrong label
    alarm.state('level')!.latestEvent = ValueEvent.parse(valueBuf(st.alarmLevel, 99), 0);
    expect(alarm.levelLabel).toBeUndefined();
  });

  it('parses a JSON text state via the typed Json() getter', () => {
    const chain = new AlarmChainControl(ctrl(ids.alarmChain), recorder().exec);
    chain.state('activeAlarmType')!.latestEvent = ValueEvent.parse(valueBuf(st.alarmActiveType, 4), 0);
    expect(chain.activeAlarmTypeLabel).toBe('Urgent');
    chain.state('activeAlarmText')!.latestEvent = TextEvent.parse(
      textBuf(st.alarmActiveText, '{"sensors":["motion","door"]}'),
      0,
    );
    expect(chain.activeAlarmTextJson<{ sensors: string[] }>()).toEqual({ sensors: ['motion', 'door'] });
  });
});

describe('parseTrackerEntries', () => {
  it('splits on | and the \\x14 newline, extracting the timestamp', () => {
    const raw =
      '2026-06-11 23:13:53 Aanwezigheid gedetecteerd\x14M08 (Hoofdslaapkamer)|2026-06-12 08:00:00 Aanwezigheid beëindigd';
    const entries = parseTrackerEntries(raw);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      timestamp: '2026-06-11 23:13:53',
      message: 'Aanwezigheid gedetecteerd M08 (Hoofdslaapkamer)',
      lines: ['Aanwezigheid gedetecteerd', 'M08 (Hoofdslaapkamer)'],
    });
    expect(entries[1]!.timestamp).toBe('2026-06-12 08:00:00');
    expect(parseTrackerEntries(undefined)).toEqual([]);
    expect(parseTrackerEntries('')).toEqual([]);
  });
});

describe('TrackerControl + TextStateControl', () => {
  it('TrackerControl.entries parses the log; raw is available', () => {
    const tracker = new TrackerControl(ctrl(ids.tracker), recorder().exec);
    tracker.state('entries')!.latestEvent = TextEvent.parse(
      textBuf(st.trackerEntries, '2026-06-12 08:00:00 Hello\x14World'),
      0,
    );
    expect(tracker.entries).toHaveLength(1);
    expect(tracker.entries[0]).toEqual({ timestamp: '2026-06-12 08:00:00', message: 'Hello World', lines: ['Hello', 'World'] });
    expect(tracker.raw).toContain('Hello');
  });

  it('TextStateControl exposes displayText and parsed iconAndColor', () => {
    const ts = new TextStateControl(ctrl(ids.textState), recorder().exec);
    ts.state('textAndIcon')!.latestEvent = TextEvent.parse(textBuf(st.textAndIcon, 'Standby'), 0);
    ts.state('iconAndColor')!.latestEvent = TextEvent.parse(textBuf(st.iconAndColor, '{"icon":"x.svg","color":"#69C350"}'), 0);
    expect(ts.displayText).toBe('Standby');
    expect(ts.iconAndColor).toEqual({ icon: 'x.svg', color: '#69C350' });
  });
});

describe('generated accessor map', () => {
  it('maps asX names to generated wrappers and skips hand-written collisions', () => {
    expect(GENERATED_ACCESSORS.asAlarm).toBe(AlarmControl);
    expect(GENERATED_ACCESSORS.asAlarmChain).toBe(AlarmChainControl);
    // ColorPicker (v1) / LightController (v1) collide with the hand-written asX
    // (which are the V2 controls), so they get a V1-suffixed accessor instead.
    expect(GENERATED_ACCESSORS.asColorPicker).toBeUndefined();
    expect(GENERATED_ACCESSORS.asLightController).toBeUndefined();
    expect(GENERATED_ACCESSORS.asColorPickerV1).toBeDefined();
    expect(GENERATED_ACCESSORS.asLightControllerV1).toBeDefined();
    for (const [name, ctor] of Object.entries(GENERATED_ACCESSORS)) {
      const base = `as${ctor.name.replace(/Control$/, '')}`;
      expect(name === base || name === `${base}V1`).toBe(true);
    }
  });
});

describe('control wrapper registry', () => {
  it('maps every wrapper type to its class', () => {
    for (const [type, ctor] of Object.entries(CONTROL_WRAPPERS)) {
      expect(ctor.controlType).toBe(type);
    }
    expect(CONTROL_WRAPPERS.Gate).toBe(GateControl);
    expect(CONTROL_WRAPPERS.IRoomControllerV2).toBe(IRoomControllerV2Control);
  });
});

function textBuf(stateUuid: string, text: string): Buffer {
  const uuid = Uuid.fromString(stateUuid).toBuffer();
  const icon = Uuid.EMPTY.toBuffer();
  const len = Buffer.alloc(4);
  len.writeUInt32LE(Buffer.byteLength(text), 0);
  const body = Buffer.concat([uuid, icon, len, Buffer.from(text, 'utf8')]);
  const pad = (4 - (body.length % 4)) % 4;
  return pad ? Buffer.concat([body, Buffer.alloc(pad)]) : body;
}
