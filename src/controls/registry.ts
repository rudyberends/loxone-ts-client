import type { Control } from '../structure/Control.js';
import { GENERATED_WRAPPERS } from './generated/index.js';
import { ColorPickerV2Control } from './ColorPickerV2Control.js';
import type { ControlCommandExecutor, ControlHandle } from './ControlHandle.js';
import { DimmerControl } from './DimmerControl.js';
import { EIBDimmerControl } from './EIBDimmerControl.js';
import { GateControl } from './GateControl.js';
import { InfoOnlyAnalogControl, InfoOnlyDigitalControl, InfoOnlyTextControl } from './InfoControls.js';
import { IRoomControllerV2Control } from './IRoomControllerV2Control.js';
import { JalousieControl } from './JalousieControl.js';
import { LightControllerV2Control } from './LightControllerV2Control.js';
import { PushbuttonControl } from './PushbuttonControl.js';
import { SwitchControl } from './SwitchControl.js';
import { TextStateControl } from './TextStateControl.js';
import { TrackerControl } from './TrackerControl.js';
import { WindowControl } from './WindowControl.js';

/** Constructor shape every typed control wrapper satisfies. */
export type ControlWrapperConstructor = {
  readonly controlType: string;
  new (control: Control, executor: ControlCommandExecutor): ControlHandle;
};

// Hand-written wrappers (richer ergonomics); these take precedence over generated ones.
const HANDWRITTEN: ControlWrapperConstructor[] = [
  SwitchControl,
  DimmerControl,
  EIBDimmerControl,
  JalousieControl,
  LightControllerV2Control,
  GateControl,
  WindowControl,
  PushbuttonControl,
  ColorPickerV2Control,
  IRoomControllerV2Control,
  InfoOnlyAnalogControl,
  InfoOnlyDigitalControl,
  InfoOnlyTextControl,
  TrackerControl,
  TextStateControl,
];

// Generated last so a hand-written wrapper wins on any controlType overlap.
const WRAPPERS: ControlWrapperConstructor[] = [...GENERATED_WRAPPERS, ...HANDWRITTEN];

/** Maps a control `type` string to its typed wrapper class. */
export const CONTROL_WRAPPERS: Readonly<Record<string, ControlWrapperConstructor>> = Object.fromEntries(
  WRAPPERS.map((ctor) => [ctor.controlType, ctor]),
);
