import { ControlHandle } from '../ControlHandle.js';

/** A status monitor block that aggregates and reports the current status of a set of monitored inputs. (generated). */
export class StatusMonitorControl extends ControlHandle {
  static readonly controlType = 'StatusMonitor';

  /** Number of inputs with state id 0. */
  get numState0(): number | undefined {
    return this.numeric('numState0');
  }
  /** Number of inputs with state id 1. */
  get numState1(): number | undefined {
    return this.numeric('numState1');
  }
  /** Number of inputs with state id 2. */
  get numState2(): number | undefined {
    return this.numeric('numState2');
  }
  /** Number of inputs with state id 3. */
  get numState3(): number | undefined {
    return this.numeric('numState3');
  }
  /** Number of inputs with state id 4. */
  get numState4(): number | undefined {
    return this.numeric('numState4');
  }
  /** Number of inputs with state id 5. */
  get numState5(): number | undefined {
    return this.numeric('numState5');
  }
  /** Number of inputs with state id 6. */
  get numState6(): number | undefined {
    return this.numeric('numState6');
  }
  /** Number of inputs with state id 7. */
  get numState7(): number | undefined {
    return this.numeric('numState7');
  }
  /** Number of inputs with state id 8. */
  get numState8(): number | undefined {
    return this.numeric('numState8');
  }
  /** Number of inputs with state id 9. */
  get numState9(): number | undefined {
    return this.numeric('numState9');
  }
  /** Number of inputs with state id 10 (default) plus inputs without a matching state value. */
  get numDef(): number | undefined {
    return this.numeric('numDef');
  }
  /** Comma-separated string of integer state ids for each monitored input; position corresponds to the inputs array in details (255 = integrated unconfigured status monitor). */
  get inputStates(): string | undefined {
    return this.text('inputStates');
  }
  /** Comma-separated string of integer state ids for each monitored input; position corresponds to the inputs array in details (parsed JSON). */
  inputStatesJson<T = unknown>(): T | undefined {
    return this.control.getState('inputStates')?.json<T>();
  }
}
