import { describe, expect, it } from 'vitest';
import { completeLine, tokenize, type CompleteContext } from '../src/cliComplete.js';

const ctx: CompleteContext = {
  rooms: ['Woonkamer', 'Werkkamer', 'Slaapkamer Evi'],
  items: ['Bureau Lamp', 'Spots'],
  types: ['Dimmer', 'Switch'],
  inRoom: false,
};
const hits = (line: string, c: CompleteContext = ctx): string[] => completeLine(line, c)[0];

describe('tokenize', () => {
  it('honours quotes', () => {
    expect(tokenize('get "Bureau Lamp"')).toEqual(['get', 'Bureau Lamp']);
    expect(tokenize('room Werkkamer lighting off')).toEqual(['room', 'Werkkamer', 'lighting', 'off']);
  });
});

describe('completeLine', () => {
  it('completes command names at the start', () => {
    expect(hits('')).toContain('rooms');
    expect(hits('ro')).toEqual(['rooms', 'room']);
  });

  it('completes room names after room/use and --room', () => {
    expect(hits('room ')).toContain('Woonkamer');
    expect(hits('room Wo')).toEqual(['Woonkamer']);
    expect(hits('use Werk')).toEqual(['Werkkamer']);
    expect(hits('items --room Wo')).toEqual(['Woonkamer']);
  });

  it('quotes multi-word names so the line re-tokenises', () => {
    expect(hits('use Slaap')).toEqual(['"Slaapkamer Evi"']);
  });

  it('completes capabilities as the room sub-command', () => {
    expect(hits('room Werkkamer ')).toContain('lighting');
    expect(hits('room Werkkamer temp')).toEqual(['temperature']);
  });

  it('completes item names for get/set and types for --type', () => {
    expect(hits('get ')).toEqual(['Bureau Lamp', 'Spots'].map((n) => (n.includes(' ') ? `"${n}"` : n)));
    expect(hits('set Spo')).toEqual(['Spots']);
    expect(hits('items --type Sw')).toEqual(['Switch']);
  });

  it('offers capabilities as top-level commands inside a room context', () => {
    expect(hits('light', { ...ctx, inRoom: true })).toContain('lighting');
    expect(hits('light')).not.toContain('lighting'); // not without context
  });
});
