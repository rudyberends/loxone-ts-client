import { describe, expect, it } from 'vitest';
import type { ControlCommandExecutor } from '../src/controls/ControlHandle.js';
import { DimmerControl } from '../src/controls/DimmerControl.js';
import { JalousieControl } from '../src/controls/JalousieControl.js';
import { LightControllerV2Control } from '../src/controls/LightControllerV2Control.js';
import { SwitchControl } from '../src/controls/SwitchControl.js';
import { ValueEvent } from '../src/protocol/events/ValueEvent.js';
import { TextMessage } from '../src/protocol/messages/TextMessage.js';
import { Uuid } from '../src/protocol/messages/Uuid.js';
import type { Control } from '../src/structure/Control.js';
import { StructureModel } from '../src/structure/StructureModel.js';
import type { LoxoneStructureFile } from '../src/structure/types.js';

const SW = 'aaaaaaaa-0000-0000-0000000000000001';
const DIM = 'aaaaaaaa-0000-0000-0000000000000002';
const JAL = 'aaaaaaaa-0000-0000-0000000000000003';
const LC = 'aaaaaaaa-0000-0000-0000000000000004';

const FIXTURE: LoxoneStructureFile = {
  lastModified: 'x',
  msInfo: {},
  rooms: {},
  cats: {},
  controls: {
    [SW]: { name: 'Lamp', type: 'Switch', uuidAction: SW, states: { active: 'bbbb0000-0000-0000-0000000000000001' } },
    [DIM]: {
      name: 'Dim',
      type: 'Dimmer',
      uuidAction: DIM,
      states: {
        position: 'bbbb0000-0000-0000-0000000000000002',
        min: 'bbbb0000-0000-0000-0000000000000003',
        max: 'bbbb0000-0000-0000-0000000000000004',
      },
    },
    [JAL]: { name: 'Blind', type: 'Jalousie', uuidAction: JAL, states: { position: 'bbbb0000-0000-0000-0000000000000005' } },
    [LC]: { name: 'Lights', type: 'LightControllerV2', uuidAction: LC, states: { activeMoods: 'bbbb0000-0000-0000-0000000000000006' } },
  },
};

function recorder(): { exec: ControlCommandExecutor; sent: string[] } {
  const sent: string[] = [];
  const exec: ControlCommandExecutor = {
    control: (_target, command) => {
      sent.push(command);
      return Promise.resolve(new TextMessage(JSON.stringify({ LL: { control: 'x', value: '1', Code: '200' } })));
    },
  };
  return { exec, sent };
}

function valueBuf(stateUuid: string, value: number): Buffer {
  const buf = Buffer.alloc(24);
  Uuid.fromString(stateUuid).toBuffer().copy(buf, 0);
  buf.writeDoubleLE(value, 16);
  return buf;
}

const model = StructureModel.parse(FIXTURE);
const ctrl = (uuid: string): Control => model.getControl(uuid)!;

describe('SwitchControl', () => {
  it('emits on/off/set commands and reads isOn', async () => {
    const { exec, sent } = recorder();
    const sw = new SwitchControl(ctrl(SW), exec);
    await sw.on();
    await sw.off();
    await sw.set(true);
    expect(sent).toEqual(['on', 'off', 'on']);

    expect(sw.isOn).toBeUndefined();
    sw.state('active')!.latestEvent = ValueEvent.parse(valueBuf('bbbb0000-0000-0000-0000000000000001', 1), 0);
    expect(sw.isOn).toBe(true);
  });
});

describe('DimmerControl', () => {
  it('clamps setPosition to [min,max] and reads position', async () => {
    const { exec, sent } = recorder();
    const dim = new DimmerControl(ctrl(DIM), exec);
    dim.state('min')!.latestEvent = ValueEvent.parse(valueBuf('bbbb0000-0000-0000-0000000000000003', 10), 0);
    dim.state('max')!.latestEvent = ValueEvent.parse(valueBuf('bbbb0000-0000-0000-0000000000000004', 90), 0);
    await dim.setPosition(50);
    await dim.setPosition(200); // clamps to 90
    await dim.setPosition(-5); // clamps to 10
    expect(sent).toEqual(['50', '90', '10']);
  });
});

describe('JalousieControl', () => {
  it('emits documented commands and converts position to percent', async () => {
    const { exec, sent } = recorder();
    const jal = new JalousieControl(ctrl(JAL), exec);
    await jal.fullDown();
    await jal.setPosition(150); // clamps to 100
    await jal.setSlats(40);
    await jal.stop();
    expect(sent).toEqual(['FullDown', 'manualPosition/100', 'manualLamelle/40', 'stop']);

    jal.state('position')!.latestEvent = ValueEvent.parse(valueBuf('bbbb0000-0000-0000-0000000000000005', 0.25), 0);
    expect(jal.position).toBe(0.25);
    expect(jal.positionPercent).toBe(25);
  });
});

describe('LightControllerV2Control', () => {
  it('emits mood commands and parses activeMoods JSON', async () => {
    const { exec, sent } = recorder();
    const lc = new LightControllerV2Control(ctrl(LC), exec);
    await lc.selectMood(3);
    await lc.allOff();
    await lc.addMood(7);
    expect(sent).toEqual(['changeTo/3', 'changeTo/0', 'addMood/7']);
    expect(lc.activeMoods).toBeUndefined();
  });
});
