/**
 * TypeScript types for the Loxone Structure File (`LoxAPP3.json`).
 *
 * These describe the raw JSON as delivered by the Miniserver. The runtime model
 * ({@link ../structure/Control.Control}, {@link ../structure/Room.Room}, ...)
 * wraps this raw data with convenience accessors.
 *
 * The shapes follow the Structure File specification; fields that vary by control
 * type are typed permissively (`string | string[]`, `Record<string, unknown>`)
 * rather than `any`, so consumers keep full type-checking.
 */

/** Map of state name to the state UUID (or an array of UUIDs for list-like states). */
export type StateMap = Record<string, string | string[]>;

/**
 * Known Loxone control `type` values. The `(string & {})` member keeps the union
 * open so unrecognised/newer types still type-check while preserving autocomplete.
 */
export type ControlType =
  | 'Alarm'
  | 'AlarmClock'
  | 'AlarmChain'
  | 'AudioZone'
  | 'AudioZoneV2'
  | 'CarCharger'
  | 'CentralAlarm'
  | 'CentralAudioZone'
  | 'CentralGate'
  | 'CentralJalousie'
  | 'CentralLightController'
  | 'CentralWindow'
  | 'ClimateController'
  | 'ColorPicker'
  | 'ColorPickerV2'
  | 'Daytimer'
  | 'Dimmer'
  | 'EIBDimmer'
  | 'EnergyManager'
  | 'EnergyManager2'
  | 'Fronius'
  | 'Gate'
  | 'Heatmixer'
  | 'Hourcounter'
  | 'InfoOnlyAnalog'
  | 'InfoOnlyDigital'
  | 'InfoOnlyText'
  | 'IRoomController'
  | 'IRoomControllerV2'
  | 'Intercom'
  | 'Irrigation'
  | 'Jalousie'
  | 'LightController'
  | 'LightControllerV2'
  | 'LightsceneRGB'
  | 'LoadManager'
  | 'MailBox'
  | 'Meter'
  | 'MsShortcut'
  | 'PoolController'
  | 'PresenceDetector'
  | 'Pushbutton'
  | 'Radio'
  | 'Remote'
  | 'Sauna'
  | 'Sequential'
  | 'Slider'
  | 'SmokeAlarm'
  | 'SolarPumpController'
  | 'SpotPriceOptimizer'
  | 'StatusMonitor'
  | 'SteakThermo'
  | 'Switch'
  | 'SystemScheme'
  | 'TextInput'
  | 'TextState'
  | 'TimedSwitch'
  | 'Tracker'
  | 'UpDownAnalog'
  | 'UpDownDigital'
  | 'ValueSelector'
  | 'Ventilation'
  | 'Webpage'
  | 'Window'
  | 'WindowMonitor'
  // Real type strings observed on hardware that differ from the doc headers:
  | 'AalEmergency'
  | 'AalSmartAlarm'
  | 'Application'
  | 'ClimateControllerUS'
  | 'EFM'
  | 'IntercomV2'
  | 'IRCV2Daytimer'
  | 'NfcCodeTouch'
  | 'PowerUnit'
  | 'PulseAt'
  | 'PVProductionForecast'
  | 'UpDownLeftRight'
  | 'Wallbox2'
  | (string & {});

/** A raw control as it appears in the structure file (mandatory + optional fields). */
/** One recorded output of a legacy (V1) statistic (`control.statistic.outputs[]`). */
export interface StatisticOutput {
  /** Datapoint-row index used for this output (0–6); also its position in the binary stream. */
  id: number;
  /** Output name. */
  name: string;
  /** printf-style format specifier for analog values. */
  format?: string;
  /** UUID of the recorded value. */
  uuid?: string;
  /** Visualisation type: `0` = line chart, `1` = digital, `2` = bar chart. */
  visuType?: 0 | 1 | 2;
}

/**
 * Legacy (V1) statistic configuration (`control.statistic`). The `outputs` order
 * is the order values appear in the `binstatisticdata` binary stream.
 */
export interface StatisticConfig {
  /** How often a value is written; see the protocol's frequency table (0–12). */
  frequency: number;
  /** The recorded outputs, in binary-stream order. */
  outputs: StatisticOutput[];
}

/** One datapoint of a {@link StatisticV2Group}. */
export interface StatisticV2DataPoint {
  /** User-friendly name to show in a graph. */
  title: string;
  /** printf-style format for the value. */
  format?: string;
  /** The name of the output/state used for recording the values. */
  output: string;
}

/** One group of a V2 statistic (`control.statisticV2.groups[]`). */
export interface StatisticV2Group {
  /** Group id — used in the `getStatistic` request. */
  id: number | string;
  /** Recording mode; see the protocol's mode table. */
  mode: number;
  /** Present & true for accumulated meters (graph the diff between values, not the raw value). */
  accumulated?: boolean;
  /** Unix-UTC timestamp since when the group has been recording. */
  activeSince?: number;
  /** Datapoints in this group, in the order they're returned when unfiltered. */
  dataPoints: StatisticV2DataPoint[];
}

/**
 * Energy-flow-era (V2) statistic configuration (`control.statisticV2`), used by
 * meters and the energy-flow monitor.
 */
export interface StatisticV2Config {
  groups: StatisticV2Group[];
}

/** Cloud-weather configuration (`structure.weatherServer`), present when Cloud Weather is set up. */
export interface WeatherServerConfig {
  /** State UUIDs delivered alongside the other live updates. */
  states?: { actual?: string; forecast?: string };
  /** C-style formats for each weather quantity. */
  format?: {
    relativeHumidity?: string;
    temperature?: string;
    windSpeed?: string;
    precipitation?: string;
    barometricPressure?: string;
  };
  /** User-friendly texts per weather-situation type. */
  weatherTypeTexts?: Record<string, string>;
  /** Possible weather field types (since Miniserver 8). */
  weatherFieldTypes?: Record<string, unknown>;
  /** Possible time fields (since Miniserver 8). */
  times?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface RawControl {
  /** Display name. */
  name: string;
  /** Control type; an empty string indicates a control that should not be visualised. */
  type: ControlType;
  /** Unique identifier for this control (used in `jdev/sps/io/{uuidAction}/...`). */
  uuidAction: string;
  /** Rating used for sorting in the UI. */
  defaultRating?: number;
  /** Whether the visualisation password must be entered for this control. */
  isSecured?: boolean;
  /** UUID of the room this control belongs to. */
  room?: string;
  /** UUID of the category this control belongs to. */
  cat?: string;
  /** State name → state UUID(s). */
  states?: StateMap;
  /** Child controls keyed by their UUID. */
  subControls?: Record<string, RawControl>;
  /** Visualisation details (format, `jLockable`, type-specific config, ...). */
  details?: Record<string, unknown>;
  /** Restriction bitmap (since 11.0). */
  restrictions?: number;
  /** Whether control notes/help texts are available (since 11.0). */
  hasControlNotes?: boolean;
  /** UUIDs of linked controls (since 11.3). */
  links?: string[];
  /** Preset reference (since 11.3). */
  preset?: { uuid: string; name: string };
  /** Legacy (V1) statistic configuration, when the control records statistics. */
  statistic?: StatisticConfig;
  /** Energy-flow-era (V2) statistic configuration, when the control supports it. */
  statisticV2?: StatisticV2Config;
  /** Indicates sensitive information is available; see Secured Details. */
  securedDetails?: unknown;
  /** Any additional, type-specific fields. */
  [key: string]: unknown;
}

/** A room entry. */
export interface RawRoom {
  uuid: string;
  name: string;
  /** Icon UUID. */
  image?: string;
  /** Sort rating. */
  defaultRating?: number;
  type?: number;
  color?: string;
}

/** A category entry. */
export interface RawCategory {
  uuid: string;
  name: string;
  image?: string;
  /** Semantic type, e.g. `lights`, `shading`, `media`, `indoortemperature`. */
  type?: string;
  color?: string;
  /** UI colour shade (since V17.0). */
  colorShade?: string;
  defaultRating?: number;
}

/** Miniserver hardware generation/type. */
export enum MiniserverType {
  Gen1 = 0,
  Gen1Go = 1,
  Gen2 = 2,
  Gen2Go = 3,
  Compact = 4,
}

/** Temperature unit used by the Miniserver (`0` = °C, `1` = °F). */
export type TempUnit = 0 | 1;

/** Static information about the Miniserver and its configuration (`msInfo`). */
export interface MsInfo {
  serialNr?: string;
  msName?: string;
  projectName?: string;
  localUrl?: string;
  remoteUrl?: string;
  hostname?: string;
  tempUnit?: TempUnit;
  currency?: string;
  squareMeasure?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  catTitle?: string;
  roomTitle?: string;
  miniserverType?: MiniserverType;
  sortByRating?: boolean;
  currentUser?: {
    name: string;
    uuid: string;
    isAdmin?: boolean;
    changePassword?: boolean;
    userRights?: number;
  };
  [key: string]: unknown;
}

/** Global state UUIDs and values that affect the whole Miniserver (`globalStates`). */
export interface GlobalStates {
  sunrise?: string;
  sunset?: string;
  favColorSequences?: string | string[];
  favColors?: string | string[];
  notifications?: string;
  miniserverTime?: string;
  liveSearch?: string;
  modifications?: string;
  operatingModes?: string;
  [key: string]: string | string[] | undefined;
}

/** The full parsed Structure File. */
export interface LoxoneStructureFile {
  /** Timestamp of the last configuration change; compare with `jdev/sps/LoxAPPversion3`. */
  lastModified: string;
  msInfo: MsInfo;
  globalStates?: GlobalStates;
  /** Operating modes keyed by id. */
  operatingModes?: Record<string, string>;
  rooms: Record<string, RawRoom>;
  cats: Record<string, RawCategory>;
  controls: Record<string, RawControl>;
  weatherServer?: WeatherServerConfig;
  mediaServer?: Record<string, unknown>;
  times?: Record<string, unknown>;
  caller?: Record<string, unknown>;
  autopilot?: Record<string, unknown>;
  messageCenter?: Record<string, unknown>;
  [key: string]: unknown;
}
