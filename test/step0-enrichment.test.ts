import { describe, expect, it } from 'vitest';
import { ControlHandle, type ControlCommandExecutor } from '../src/controls/ControlHandle.js';
import { CONTROL_WRAPPERS } from '../src/controls/registry.js';
import { EIBDimmerControl } from '../src/controls/EIBDimmerControl.js';
import { DimmerControl } from '../src/controls/DimmerControl.js';
import { IntercomControl } from '../src/controls/IntercomControl.js';
import { IntercomV2Control } from '../src/controls/IntercomV2Control.js';
import { IrrigationControl } from '../src/controls/IrrigationControl.js';
import { WindowMonitorControl } from '../src/controls/WindowMonitorControl.js';
import { LoxoneCommandError, LoxoneTimeoutError, LoxoneStateError } from '../src/errors.js';
import { TextEvent } from '../src/protocol/events/TextEvent.js';
import { TextMessage } from '../src/protocol/messages/TextMessage.js';
import { Uuid } from '../src/protocol/messages/Uuid.js';
import type { Control } from '../src/structure/Control.js';
import { StructureModel } from '../src/structure/StructureModel.js';
import type { LoxoneStructureFile } from '../src/structure/types.js';

const ids = {
  tempSensor: 'cccc0000-0000-0000-0000000000000101',
  luxSensor: 'cccc0000-0000-0000-0000000000000102',
  humSensor: 'cccc0000-0000-0000-0000000000000103',
  eib: 'cccc0000-0000-0000-0000000000000104',
  intercom: 'cccc0000-0000-0000-0000000000000105',
  intercom2: 'cccc0000-0000-0000-0000000000000106',
  irrigation: 'cccc0000-0000-0000-0000000000000107',
  monitor: 'cccc0000-0000-0000-0000000000000108',
};
const st = {
  zones: 'dddd0000-0000-0000-0000000000000107',
  windowStates: 'dddd0000-0000-0000-0000000000000108',
  eibPos: 'dddd0000-0000-0000-0000000000000104',
};

const FIXTURE: LoxoneStructureFile = {
  lastModified: 'x',
  msInfo: {},
  rooms: {},
  cats: { lightCat: { uuid: 'lightCat', name: 'Lights', type: 'lights', image: 'icons/lights.svg' } },
  controls: {
    [ids.tempSensor]: { name: 'Temp', type: 'InfoOnlyAnalog', uuidAction: ids.tempSensor, details: { format: '%.1f°C' }, states: {} },
    [ids.luxSensor]: { name: 'Lux', type: 'InfoOnlyAnalog', uuidAction: ids.luxSensor, details: { format: '%.0f Lx' }, states: {} },
    [ids.humSensor]: {
      name: 'Hum',
      type: 'InfoOnlyAnalog',
      uuidAction: ids.humSensor,
      cat: 'lightCat',
      defaultIcon: { href: 'icons/IconLock.svg' },
      details: { format: '%.0f %%' },
      states: {},
    },
    [ids.eib]: { name: 'EIB', type: 'EIBDimmer', uuidAction: ids.eib, states: { position: st.eibPos } },
    [ids.intercom]: { name: 'Door', type: 'Intercom', uuidAction: ids.intercom, states: {} },
    [ids.intercom2]: { name: 'DoorV2', type: 'IntercomV2', uuidAction: ids.intercom2, states: {} },
    [ids.irrigation]: { name: 'Garden', type: 'Irrigation', uuidAction: ids.irrigation, states: { zones: st.zones } },
    [ids.monitor]: {
      name: 'Windows',
      type: 'WindowMonitor',
      uuidAction: ids.monitor,
      details: { windows: [{ name: 'Kitchen' }, { name: 'Bath' }, { name: 'Hall' }] },
      states: { windowStates: st.windowStates },
    },
  },
};

const model = StructureModel.parse(FIXTURE);
const ctrl = (uuid: string): Control => model.getControl(uuid)!;

/** An executor whose control() returns a fixed enveloped value. */
function executorReturning(value: unknown): ControlCommandExecutor {
  return { control: () => Promise.resolve(new TextMessage(JSON.stringify({ LL: { control: 'x', value, Code: '200' } }))) };
}
const noopExec: ControlCommandExecutor = { control: () => Promise.resolve(new TextMessage('{}')) };

function textBuf(stateUuid: string, text: string): Buffer {
  const uuid = Uuid.fromString(stateUuid).toBuffer();
  const icon = Uuid.EMPTY.toBuffer();
  const len = Buffer.alloc(4);
  len.writeUInt32LE(Buffer.byteLength(text), 0);
  const body = Buffer.concat([uuid, icon, len, Buffer.from(text, 'utf8')]);
  const pad = (4 - (body.length % 4)) % 4;
  return pad ? Buffer.concat([body, Buffer.alloc(pad)]) : body;
}

describe('#1 Control metadata accessors', () => {
  it('parses format → unit → sensorKind', () => {
    expect(ctrl(ids.tempSensor).format).toBe('%.1f°C');
    expect(ctrl(ids.tempSensor).unit).toBe('°C');
    expect(ctrl(ids.tempSensor).sensorKind).toBe('temperature');

    expect(ctrl(ids.luxSensor).unit).toBe('Lx');
    expect(ctrl(ids.luxSensor).sensorKind).toBe('illuminance');

    // '%' → humidity unless the name signals another quantity
    expect(ctrl(ids.humSensor).unit).toBe('%');
    expect(ctrl(ids.humSensor).sensorKind).toBe('humidity');
  });

  it('treats % as humidity but excludes power/valve/setpoint/etc. by name', () => {
    const kindOf = (name: string, format: string): string | undefined =>
      StructureModel.parse({
        ...FIXTURE,
        controls: { x: { name, type: 'InfoOnlyAnalog', uuidAction: 'x', details: { format }, states: {} } },
      }).getControl('x')!.sensorKind;

    expect(kindOf('Badkamer Vocht', '%.0f %%')).toBe('humidity');
    expect(kindOf('SL02', '%.0f %%')).toBe('humidity'); // plainly-named humidity still works
    expect(kindOf('CV Vermogen', '%.1f %%')).toBeUndefined(); // heating power %
    expect(kindOf('Klep stand', '%.0f %%')).toBeUndefined(); // valve %
    expect(kindOf('Accu niveau', '%.0f %%')).toBeUndefined(); // battery/level %
    expect(kindOf('SetPoint Temperatuur', '%.1f°C')).toBeUndefined(); // a setpoint, not ambient
    expect(kindOf('Buiten', '%.1f°C')).toBe('temperature');
  });

  it('exposes control + category icon references', () => {
    expect(ctrl(ids.humSensor).defaultIcon).toBe('icons/IconLock.svg');
    expect(ctrl(ids.humSensor).categoryIcon).toBe('icons/lights.svg');
    expect(ctrl(ids.tempSensor).defaultIcon).toBeUndefined();
  });

  it('parses unit robustly (trailing unit, %% escape, multiple/odd formats)', () => {
    const unitOf = (format: string): string | undefined =>
      StructureModel.parse({
        ...FIXTURE,
        controls: { x: { name: 'x', type: 'InfoOnlyAnalog', uuidAction: 'x', details: { format }, states: {} } },
      }).getControl('x')!.unit;

    expect(unitOf('%.3f€/kWh')).toBe('€/kWh');
    expect(unitOf('%.0fppm')).toBe('ppm');
    expect(unitOf('%i')).toBeUndefined(); // no unit text
    expect(unitOf('%.0f %%')).toBe('%'); // %% escape collapses, no corruption
    // a %% escape before the real conversion must not corrupt the output
    expect(unitOf('%% RH %.0f')).toBeUndefined(); // text after last conversion is empty
    expect(unitOf('<v.1>%.1f°C')).toBe('°C'); // markup stripped
  });
});

describe('#6 requireState + stateNames', () => {
  it('stateNames lists the control states', () => {
    expect(ctrl(ids.irrigation).stateNames).toContain('zones');
  });
  it('requireState throws a descriptive error for a missing state', () => {
    const h = new IrrigationControl(ctrl(ids.irrigation), noopExec);
    expect(h.requireState('zones').name).toBe('zones');
    expect(() => h.requireState('nope')).toThrow(LoxoneStateError);
    expect(() => h.requireState('nope')).toThrow(/Available: zones/);
  });
});

describe('#5 LoxoneCommandError.kind', () => {
  it('defaults to rejected; timeout is comms', () => {
    expect(new LoxoneCommandError('x').kind).toBe('rejected');
    expect(new LoxoneCommandError('x', { kind: 'locked' }).kind).toBe('locked');
    expect(new LoxoneTimeoutError('t', { command: 'c' }).kind).toBe('comms');
    expect(new LoxoneTimeoutError('t') instanceof LoxoneCommandError).toBe(true);
  });
});

describe('#7a EIBDimmerControl', () => {
  it('is registered for EIBDimmer and reuses Dimmer behaviour', async () => {
    expect(CONTROL_WRAPPERS.EIBDimmer).toBe(EIBDimmerControl);
    expect(EIBDimmerControl.controlType).toBe('EIBDimmer');
    expect(new EIBDimmerControl(ctrl(ids.eib), noopExec)).toBeInstanceOf(DimmerControl);

    const sent: string[] = [];
    const rec: ControlCommandExecutor = {
      control: (_t, c) => { sent.push(c); return Promise.resolve(new TextMessage('{}')); },
    };
    const eib = new EIBDimmerControl(ctrl(ids.eib), rec);
    await eib.setPosition(150); // clamps to 100
    expect(sent).toEqual(['100']);
  });
});

describe('#2 Intercom securedDetails', () => {
  const details = { videoInfo: { streamUrl: 'rtsp://x', user: 'u', pass: 'p' }, audioInfo: { host: 'h' } };
  it('parses an object-valued response', async () => {
    const ic = new IntercomControl(ctrl(ids.intercom), executorReturning(details));
    expect(ic).toBeInstanceOf(ControlHandle);
    await expect(ic.securedDetails()).resolves.toEqual(details);
    // generated getters still available
    expect(typeof ic.bell).toBe('undefined'); // no event yet
  });
  it('parses a string-valued (JSON) response and works on V2', async () => {
    const v2 = new IntercomV2Control(ctrl(ids.intercom2), executorReturning(JSON.stringify(details)));
    await expect(v2.securedDetails()).resolves.toEqual(details);
  });
});

describe('#4 Irrigation zoneList', () => {
  it('parses the zones JSON state into a typed array', () => {
    const irr = new IrrigationControl(ctrl(ids.irrigation), noopExec);
    irr.state('zones')!.latestEvent = TextEvent.parse(
      textBuf(st.zones, JSON.stringify([{ id: 0, name: 'Front', duration: 600 }, { id: 1, name: 'Back' }])),
      0,
    );
    expect(irr.zoneList).toEqual([{ id: 0, name: 'Front', duration: 600 }, { id: 1, name: 'Back' }]);
  });
});

describe('#7b WindowMonitor decoded windows (generic "Contact")', () => {
  it('decodes the windowStates bitmask per window with names', () => {
    const wm = new WindowMonitorControl(ctrl(ids.monitor), noopExec);
    expect(wm.windows).toEqual(['Kitchen', 'Bath', 'Hall']);
    // 1=closed, 4=open, 2=tilted
    wm.state('windowStates')!.latestEvent = TextEvent.parse(textBuf(st.windowStates, '1,4,2'), 0);
    const s = wm.windowStatuses!;
    expect(s).toHaveLength(3);
    expect(s[0]).toMatchObject({ index: 0, name: 'Kitchen', closed: true, open: false });
    expect(s[1]).toMatchObject({ index: 1, name: 'Bath', open: true, closed: false });
    expect(s[2]).toMatchObject({ index: 2, name: 'Hall', tilted: true });
  });
});
