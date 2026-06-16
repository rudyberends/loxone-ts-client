import { describe, expect, it } from 'vitest';
import { parseLoxLive } from '../src/discovery/discovery.js';

// A synthetic reply that mirrors the real wire format — note the device name
// contains both a space and a slash, the trickiest part to parse.
const SAMPLE =
  'LoxLIVE: Demo House/Ground Floor 192.168.50.10:80 504F94ABCDEF 14.5.12.30 Prog:2024-01-02 03:04:05 Type:0 HwId:A0000 IPv6:,00000000:0/X,13000003:16000916/O';

describe('parseLoxLive', () => {
  it('parses a reply whose name contains spaces (and a slash)', () => {
    const ms = parseLoxLive(SAMPLE);
    expect(ms).toBeDefined();
    expect(ms).toMatchObject({
      name: 'Demo House/Ground Floor',
      host: '192.168.50.10',
      port: 80,
      address: '192.168.50.10:80',
      serial: '504F94ABCDEF',
      firmwareVersion: '14.5.12.30',
      configDate: '2024-01-02 03:04:05',
      type: 0,
      hwId: 'A0000',
    });
  });

  it('parses the canonical example from the spec', () => {
    const ms = parseLoxLive(
      'LoxLIVE: Loxone Miniserver 192.168.178.32:80 504F11223344 10.2.3.26 Prog:2019-04-24 21:08:03 Type:0 HwId:A0000 IPv6:,0c112233:10020217/O',
    );
    expect(ms).toMatchObject({
      name: 'Loxone Miniserver',
      host: '192.168.178.32',
      port: 80,
      serial: '504F11223344',
      firmwareVersion: '10.2.3.26',
      configDate: '2019-04-24 21:08:03',
    });
  });

  it('tolerates a trailing newline and surrounding whitespace', () => {
    expect(parseLoxLive(`  ${SAMPLE}\n`)?.serial).toBe('504F94ABCDEF');
  });

  it('still parses when optional labelled fields are missing', () => {
    const ms = parseLoxLive('LoxLIVE: My MS 10.0.0.5:8080 AABBCCDDEEFF 12.0.1.0');
    expect(ms).toMatchObject({
      name: 'My MS',
      host: '10.0.0.5',
      port: 8080,
      serial: 'AABBCCDDEEFF',
      firmwareVersion: '12.0.1.0',
    });
    expect(ms?.configDate).toBeUndefined();
    expect(ms?.type).toBeUndefined();
    expect(ms?.hwId).toBeUndefined();
  });

  it('returns undefined for non-LoxLIVE or address-less input', () => {
    expect(parseLoxLive('hello world')).toBeUndefined();
    expect(parseLoxLive('')).toBeUndefined();
    expect(parseLoxLive('LoxLIVE: no address here')).toBeUndefined();
    expect(parseLoxLive('\x00\x01\x02')).toBeUndefined();
  });
});
