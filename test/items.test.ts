import { describe, expect, it } from 'vitest';
import { LoxoneClient } from '../src/LoxoneClient.js';
import { DimmerControl } from '../src/controls/DimmerControl.js';
import { GateControl } from '../src/controls/GateControl.js';
import { StructureModel } from '../src/structure/StructureModel.js';
import type { LoxoneStructureFile } from '../src/structure/types.js';

const FIXTURE: LoxoneStructureFile = {
  lastModified: 'x',
  msInfo: {},
  rooms: {
    living: { uuid: 'living', name: 'Living Room' },
    kitchen: { uuid: 'kitchen', name: 'Kitchen' },
  },
  cats: { lights: { uuid: 'lights', name: 'Lights', type: 'lights' } },
  controls: {
    dimmer: { name: 'Lamp', type: 'Dimmer', uuidAction: 'dimmer', room: 'living', cat: 'lights', states: { position: 'p1' } },
    sw: { name: 'Kettle', type: 'Switch', uuidAction: 'sw', room: 'kitchen', states: {} },
    gate: { name: 'Garage', type: 'Gate', uuidAction: 'gate', states: {} }, // no room
    hidden: { name: 'Hidden', type: '', uuidAction: 'hidden', states: {} }, // not visualised
    parent: {
      name: 'Group',
      type: 'Switch',
      uuidAction: 'parent',
      room: 'living',
      states: {},
      subControls: { child: { name: 'Sub', type: 'Dimmer', uuidAction: 'child', states: {} } },
    },
  },
};

/** An offline client with a pre-parsed structure injected (no connection). */
function clientWith(file: LoxoneStructureFile): LoxoneClient {
  const c = new LoxoneClient('127.0.0.1', 'u', 'p', { autoReconnect: false });
  (c as unknown as { _structure: StructureModel })._structure = StructureModel.parse(file);
  return c;
}

describe('client.items() — high-level typed view', () => {
  it('returns typed handles for top-level, visualised controls only', () => {
    const c = clientWith(FIXTURE);
    const items = c.items();
    expect(items.map((i) => i.name).sort()).toEqual(['Garage', 'Group', 'Kettle', 'Lamp']); // no Hidden, no Sub
    expect(c.items().find((i) => i.name === 'Lamp')).toBeInstanceOf(DimmerControl);
    expect(c.items().find((i) => i.name === 'Garage')).toBeInstanceOf(GateControl);
  });

  it('includes sub-controls only when asked', () => {
    const c = clientWith(FIXTURE);
    expect(c.items().some((i) => i.name === 'Sub')).toBe(false);
    expect(c.items({ includeSubControls: true }).some((i) => i.name === 'Sub')).toBe(true);
  });

  it('filters by type / room / category (case-insensitive)', () => {
    const c = clientWith(FIXTURE);
    expect(c.items({ type: 'dimmer' }).map((i) => i.name)).toEqual(['Lamp']);
    expect(c.itemsInRoom('living room').map((i) => i.name).sort()).toEqual(['Group', 'Lamp']);
    expect(c.itemsInCategory('lights').map((i) => i.name)).toEqual(['Lamp']);
  });

  it('groups by room and by category', () => {
    const c = clientWith(FIXTURE);
    const byRoom = c.itemsByRoom();
    expect(byRoom.get('Living Room')!.map((i) => i.name).sort()).toEqual(['Group', 'Lamp']);
    expect(byRoom.get('Kitchen')!.map((i) => i.name)).toEqual(['Kettle']);
    expect(byRoom.get('Unassigned')!.map((i) => i.name)).toEqual(['Garage']); // room-less

    const byCat = c.itemsByCategory();
    expect(byCat.get('Lights')!.map((i) => i.name)).toEqual(['Lamp']);
    expect(byCat.get('Uncategorised')!.map((i) => i.name).sort()).toEqual(['Garage', 'Group', 'Kettle']);
  });

  it('caches handles by control (stable identity) and exposes room/category on the handle', () => {
    const c = clientWith(FIXTURE);
    const a = c.item('dimmer');
    expect(a).toBe(c.item('dimmer')); // same instance
    expect(a).toBe(c.items().find((i) => i.name === 'Lamp')); // items() reuses the cache
    expect(a).toBeInstanceOf(DimmerControl);
    expect(a!.roomName).toBe('Living Room');
    expect(a!.categoryName).toBe('Lights');
    expect(c.item('gate')!.roomName).toBe('Unassigned');
  });

  it('returns nothing before a structure is loaded', () => {
    const c = new LoxoneClient('127.0.0.1', 'u', 'p', { autoReconnect: false });
    expect(c.items()).toEqual([]);
    expect(c.itemsByRoom().size).toBe(0);
  });
});
