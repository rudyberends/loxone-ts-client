import { ensureReadable } from '../byteBounds.js';
import { loxoneEpochToDate } from '../loxoneEpoch.js';
import { Uuid } from '../messages/Uuid.js';
import { LoxoneEvent } from './LoxoneEvent.js';

/** A single weather forecast/observation entry. */
export interface WeatherEntry {
  /** Entry timestamp (seconds since 2009-01-01 UTC). */
  timestamp: number;
  /** Loxone weather type code. */
  weatherType: number;
  /** Wind direction in degrees. */
  windDirection: number;
  /** Solar radiation (W/m²). */
  solarRadiation: number;
  /** Relative humidity (%). */
  relativeHumidity: number;
  /** Temperature (°C). */
  temperature: number;
  /** Perceived ("feels like") temperature (°C). */
  perceivedTemperature: number;
  /** Dew point (°C). */
  dewPoint: number;
  /** Precipitation (mm). */
  precipitation: number;
  /** Wind speed (km/h). */
  windSpeed: number;
  /** Barometric pressure (hPa). */
  barometricPressure: number;
}

/**
 * A weather-state update.
 *
 * ```
 * typedef struct {
 *   PUUID uuid;
 *   unsigned int lastUpdate;  // seconds since 2009 UTC
 *   int nrEntries;
 *   // EvDataWeatherEntry[nrEntries] follows (68 bytes each)
 * } PACKED EvDataWeather;
 * ```
 */
export class WeatherEvent extends LoxoneEvent {
  /** Last-update time of the weather data (seconds since 2009-01-01 UTC). */
  readonly lastUpdate: number;
  /** The weather entries. */
  readonly entries: readonly WeatherEntry[];
  private readonly _byteLength: number;

  private constructor(uuid: Uuid, lastUpdate: number, entries: WeatherEntry[], byteLength: number) {
    super(uuid);
    this.lastUpdate = lastUpdate;
    this.entries = entries;
    this._byteLength = byteLength;
  }

  private static readonly ENTRY_SIZE = 68;
  private static readonly HEADER_SIZE = Uuid.BYTE_LENGTH + 4 + 4; // uuid + lastUpdate + nrEntries

  static parse(buffer: Buffer, offset: number): WeatherEvent {
    ensureReadable(buffer, offset, WeatherEvent.HEADER_SIZE, 'weather event header');
    let cursor = offset;
    const uuid = Uuid.fromBuffer(buffer, cursor);
    cursor += Uuid.BYTE_LENGTH;
    const lastUpdate = buffer.readUInt32LE(cursor);
    cursor += 4;
    const count = buffer.readInt32LE(cursor);
    cursor += 4;
    // `count` is signed and untrusted: validate the whole entry span up front so
    // a corrupt (huge/negative) count can't trigger a big allocation or over-read.
    ensureReadable(buffer, cursor, count * WeatherEvent.ENTRY_SIZE, 'weather entries');

    const entries: WeatherEntry[] = [];
    for (let i = 0; i < count; i++) {
      entries.push({
        timestamp: buffer.readInt32LE(cursor),
        weatherType: buffer.readInt32LE(cursor + 4),
        windDirection: buffer.readInt32LE(cursor + 8),
        solarRadiation: buffer.readInt32LE(cursor + 12),
        relativeHumidity: buffer.readInt32LE(cursor + 16),
        temperature: buffer.readDoubleLE(cursor + 20),
        perceivedTemperature: buffer.readDoubleLE(cursor + 28),
        dewPoint: buffer.readDoubleLE(cursor + 36),
        precipitation: buffer.readDoubleLE(cursor + 44),
        windSpeed: buffer.readDoubleLE(cursor + 52),
        barometricPressure: buffer.readDoubleLE(cursor + 60),
      });
      cursor += WeatherEvent.ENTRY_SIZE;
    }

    const byteLength = Uuid.BYTE_LENGTH + 4 + 4 + count * WeatherEvent.ENTRY_SIZE;
    return new WeatherEvent(uuid, lastUpdate, entries, byteLength);
  }

  override get byteLength(): number {
    return this._byteLength;
  }

  /** {@link lastUpdate} as a JS `Date`. */
  get lastUpdateDate(): Date {
    return loxoneEpochToDate(this.lastUpdate);
  }

  /** A weather entry's `timestamp` as a JS `Date`. */
  entryDate(entry: WeatherEntry): Date {
    return loxoneEpochToDate(entry.timestamp);
  }

  override toString(): string {
    return `${this.toPath()} = weather(${this.entries.length} entries)`;
  }
}
