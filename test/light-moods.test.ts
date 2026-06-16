import { describe, expect, it } from 'vitest';
import { RoomView } from '../src/client/RoomView.js';
import { LightControllerV2Control } from '../src/controls/LightControllerV2Control.js';
import type { ControlCommandExecutor } from '../src/controls/ControlHandle.js';
import { LoxoneStateError } from '../src/errors.js';
import { TextEvent } from '../src/protocol/events/TextEvent.js';
import { TextMessage } from '../src/protocol/messages/TextMessage.js';
import { Uuid } from '../src/protocol/messages/Uuid.js';
import { Room } from '../src/structure/Room.js';
import { StructureModel } from '../src/structure/StructureModel.js';
import type { LoxoneStructureFile } from '../src/structure/types.js';

const MOODLIST = 'dddd0000-0000-0000-0000000000000501';
const ACTIVE = 'dddd0000-0000-0000-0000000000000502';

const FIXTURE: LoxoneStructureFile = {
  lastModified: 'x',
  msInfo: {},
  rooms: {},
  cats: {},
  controls: {
    lc: { name: 'Living Lights', type: 'LightControllerV2', uuidAction: 'lc', states: { moodList: MOODLIST, activeMoods: ACTIVE } },
  },
};

const model = StructureModel.parse(FIXTURE);
function textBuf(stateUuid: string, text: string): Buffer {
  const uuid = Uuid.fromString(stateUuid).toBuffer();
  const icon = Uuid.EMPTY.toBuffer();
  const len = Buffer.alloc(4);
  len.writeUInt32LE(Buffer.byteLength(text), 0);
  const body = Buffer.concat([uuid, icon, len, Buffer.from(text, 'utf8')]);
  const pad = (4 - (body.length % 4)) % 4;
  return pad ? Buffer.concat([body, Buffer.alloc(pad)]) : body;
}

function makeController(): { lc: LightControllerV2Control; sent: string[] } {
  const sent: string[] = [];
  const exec: ControlCommandExecutor = {
    control: (_t, command) => {
      sent.push(command);
      return Promise.resolve(new TextMessage(JSON.stringify({ LL: { control: 'x', value: '1', Code: '200' } })));
    },
  };
  const lc = new LightControllerV2Control(model.getControl('lc')!, exec);
  lc.state('moodList')!.latestEvent = TextEvent.parse(
    textBuf(MOODLIST, JSON.stringify([
      { id: 1, name: 'Bright' },
      { id: 2, name: 'Avond' },
      { id: 778, name: 'Off' },
    ])),
    0,
  );
  return { lc, sent };
}

describe('LightControllerV2 moods — see & set', () => {
  it('lists available moods and resolves the active ones by name', () => {
    const { lc } = makeController();
    expect(lc.moods?.map((m) => m.name)).toEqual(['Bright', 'Avond', 'Off']);

    lc.state('activeMoods')!.latestEvent = TextEvent.parse(textBuf(ACTIVE, '[2]'), 0);
    expect(lc.activeMoods).toEqual([2]);
    expect(lc.activeMoodList?.map((m) => m.name)).toEqual(['Avond']);
    expect(lc.activeMood?.name).toBe('Avond');
  });

  it('selects a mood by id and by name', async () => {
    const { lc, sent } = makeController();
    await lc.selectMood(1);
    await lc.selectMoodByName('Avond'); // case-insensitive lookup → id 2
    await lc.selectMoodByName('off'); // → id 778
    expect(sent).toEqual(['changeTo/1', 'changeTo/2', 'changeTo/778']);
  });

  it('throws (listing moods) when selecting an unknown mood name', async () => {
    const { lc } = makeController();
    expect(lc.findMood('Nope')).toBeUndefined();
    await expect(lc.selectMoodByName('Nope')).rejects.toThrow(LoxoneStateError);
    await expect(lc.selectMoodByName('Nope')).rejects.toThrow(/Available: Bright, Avond, Off/);
  });

  it('room lighting treats the all-off mood (778) as off, not on', () => {
    const { lc } = makeController();
    const room = new RoomView({ itemsInRoom: () => [lc], item: () => undefined }, new Room('r', 'Test'));
    lc.state('activeMoods')!.latestEvent = TextEvent.parse(textBuf(ACTIVE, '[778]'), 0); // only "Off"
    expect(room.lighting.isOn).toBe(false);
    lc.state('activeMoods')!.latestEvent = TextEvent.parse(textBuf(ACTIVE, '[1]'), 0); // "Bright"
    expect(room.lighting.isOn).toBe(true);
  });
});
