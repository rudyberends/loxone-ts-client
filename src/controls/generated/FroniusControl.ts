import { ControlHandle } from '../ControlHandle.js';

const generatorTypeLabelMap: Readonly<Record<number, 'Fronius' | 'Inputs' | 'Kostal'>> = { [0]: 'Fronius', [1]: 'Inputs', [2]: 'Kostal' };
const onlineLabelMap: Readonly<Record<number, 'online' | 'offline'>> = { [0]: 'online', [1]: 'offline' };

/** Energy Monitor reporting PV production, consumption, grid, battery, earnings and CO2 data. (generated). */
export class FroniusControl extends ControlHandle {
  static readonly controlType = 'Fronius';

  /** Current production power [kW]. */
  get prodCurr(): number | undefined {
    return this.numeric('prodCurr');
  }
  /** Energy production over the current day [kWh]. */
  get prodCurrDay(): number | undefined {
    return this.numeric('prodCurrDay');
  }
  /** Energy production over the current month [kWh]. */
  get prodCurrMonth(): number | undefined {
    return this.numeric('prodCurrMonth');
  }
  /** Energy production over the current year [kWh]. */
  get prodCurrYear(): number | undefined {
    return this.numeric('prodCurrYear');
  }
  /** Total energy production since setup [kWh]. */
  get prodTotal(): number | undefined {
    return this.numeric('prodTotal');
  }
  /** Current consumption power [kW]. */
  get consCurr(): number | undefined {
    return this.numeric('consCurr');
  }
  /** Energy consumed throughout the current day [kWh]. */
  get consCurrDay(): number | undefined {
    return this.numeric('consCurrDay');
  }
  /** Current grid consumption/delivery power [kW]; negative means delivering to grid. */
  get gridCurr(): number | undefined {
    return this.numeric('gridCurr');
  }
  /** Current battery charging/usage power [kW]; negative means charging. */
  get batteryCurr(): number | undefined {
    return this.numeric('batteryCurr');
  }
  /** Battery charging state 0-100; 100 = fully charged. */
  get stateOfCharge(): number | undefined {
    return this.numeric('stateOfCharge');
  }
  /** Money earned today from self-consumption or export. */
  get earningsDay(): number | undefined {
    return this.numeric('earningsDay');
  }
  /** Money earned this month. */
  get earningsMonth(): number | undefined {
    return this.numeric('earningsMonth');
  }
  /** Money earned this year. */
  get earningsYear(): number | undefined {
    return this.numeric('earningsYear');
  }
  /** Total money earned. */
  get earningsTotal(): number | undefined {
    return this.numeric('earningsTotal');
  }
  /** Price per unit when exporting to the grid. */
  get priceDelivery(): number | undefined {
    return this.numeric('priceDelivery');
  }
  /** Price per unit while consuming from the grid. */
  get priceConsumption(): number | undefined {
    return this.numeric('priceConsumption');
  }
  /** CO2 per kWh, used to compute CO2 savings. */
  get co2Factor(): number | undefined {
    return this.numeric('co2Factor');
  }
  /** Data source: 0=Fronius, 1=Inputs, 2=Kostal. */
  get generatorType(): number | undefined {
    return this.numeric('generatorType');
  }
  /** Data source: 0=Fronius, 1=Inputs, 2=Kostal (decoded label). */
  get generatorTypeLabel(): ('Fronius' | 'Inputs' | 'Kostal') | undefined {
    const v = this.numeric('generatorType');
    return v === undefined ? undefined : generatorTypeLabelMap[v];
  }
  /** Bitmask of available data sources on this energy monitor. */
  get mode(): number | undefined {
    return this.numeric('mode');
  }
  /** Connection state: 0=online, 1=offline. */
  get online(): number | undefined {
    return this.numeric('online');
  }
  /** Connection state: 0=online, 1=offline (decoded label). */
  get onlineLabel(): ('online' | 'offline') | undefined {
    const v = this.numeric('online');
    return v === undefined ? undefined : onlineLabelMap[v];
  }
}
