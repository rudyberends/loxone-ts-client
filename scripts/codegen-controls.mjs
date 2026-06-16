// Dev tool: generates typed control wrappers under src/controls/generated/ from
// a specs JSON file (produced by the spec-all-control-types workflow).
//   node scripts/codegen-controls.mjs <specs.json>
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'src/controls/generated');

// Control types already hand-written — never regenerate these.
const HANDWRITTEN = new Set([
  'Switch', 'Dimmer', 'Jalousie', 'Gate', 'Window', 'Pushbutton', 'ColorPickerV2',
  'LightControllerV2', 'IRoomControllerV2', 'InfoOnlyAnalog', 'InfoOnlyDigital', 'InfoOnlyText',
  'Tracker', 'TextState',
]);

// Members of ControlHandle that generated getters/methods must not shadow.
const RESERVED = new Set(['control', 'executor', 'uuid', 'name', 'type', 'send', 'state', 'numeric', 'boolean', 'text', 'constructor']);

const TS_TYPE = { number: 'number', boolean: 'boolean', text: 'string' };
const HELPER = { number: 'numeric', boolean: 'boolean', text: 'text' };

const specsPath = process.argv[2];
if (!specsPath) throw new Error('usage: codegen-controls.mjs <specs.json>');
const specs = JSON.parse(readFileSync(specsPath, 'utf8'));

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const ident = (s) => {
  const cleaned = String(s).replace(/[^A-Za-z0-9_]/g, '');
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `C${cleaned}`;
};
const tsString = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

// A clamp(0,1)+round param is usually a boolean flag — expose it as one, UNLESS
// its name reads like a discrete selector/index (e.g. sensorIndex 0|1), which is
// semantically a number, not a flag.
const SELECTOR_NAME = /index|idx|sensor|channel|slot|select/i;
const isBooleanParam = (p) =>
  p.kind === 'number' && p.clampMin === 0 && p.clampMax === 1 && p.round === true && !SELECTOR_NAME.test(p.name);
// Loxone-epoch timestamp states get a paired `${name}Date` getter. Loxone counts
// seconds since 2009; its docs say both "since 2009" and (loosely) "Unix timestamp"
// for the same convention. Exclude "since midnight" (a time-of-day, not an epoch).
const isEpochState = (g) =>
  g.kind === 'number' &&
  !/since\s+midnight/i.test(g.doc || '') &&
  (/since\s+(2009|1\.1\.2009)/i.test(g.doc || '') || /unix\s*timestamp/i.test(g.doc || ''));

// Avoid `oneTimePulseDateDate` / `nextEntryTimeDate` stutter: drop a trailing
// Date/Time/At/On before appending the `Date` suffix.
const dateGetterName = (name) => `${name.replace(/(Date|Time|At|On)$/i, '')}Date`;

// A text state whose doc says it carries JSON gets a parsed `${name}Json<T>()`.
const isJsonState = (g) => g.kind === 'text' && /\b(json|object|array)\b/i.test(g.doc || '');

/**
 * Extracts `code -> label` pairs from an enum-style doc, e.g.
 * "1=Silent, 2=Acustic" or "0 = Automatic, heating allowed / 1 = Manual".
 * Splits on the NEXT `N=`/`N->` marker so labels may contain commas.
 */
function parseEnumLabels(doc) {
  if (!doc) return null;
  const marks = [...doc.matchAll(/(-?\d+)\s*(?:=>|->|=)\s*/g)];
  if (marks.length < 2) return null;
  const out = [];
  for (let i = 0; i < marks.length; i++) {
    const code = Number(marks[i][1]);
    const start = marks[i].index + marks[i][0].length;
    const end = i + 1 < marks.length ? marks[i + 1].index : doc.length;
    const label = doc
      .slice(start, end)
      .replace(/\s*\(.*$/s, '') // drop a trailing parenthetical note
      .replace(/[\s,;/|).!]+$/, '')
      .trim();
    // Bail on anything that looks like prose/bitmask rather than a clean label —
    // a wrong label is worse than exposing the raw number.
    if (!label || label.length > 28 || Number.isNaN(code)) return null;
    if (/[,]|0x|\betc\b|\belse\b/i.test(label)) return null;
    out.push([code, label]);
  }
  // Require unique codes and labels to avoid mis-parses producing a junk union.
  const codes = new Set(out.map((e) => e[0]));
  const labels = new Set(out.map((e) => e[1]));
  if (codes.size !== out.length || labels.size !== out.length) return null;
  return out;
}

function paramInfo(p) {
  if (isBooleanParam(p)) return { tsType: 'boolean', expr: `${p.name} ? 1 : 0` };
  if (p.kind === 'string') return { tsType: 'string', expr: `encodeURIComponent(${p.name})` };
  if (typeof p.clampMin === 'number' && typeof p.clampMax === 'number') return { tsType: 'number', expr: `clamp(${p.name}, ${p.clampMin}, ${p.clampMax})`, usesClamp: true };
  if (p.round) return { tsType: 'number', expr: `Math.round(${p.name})` };
  return { tsType: 'number', expr: p.name };
}

function buildWire(template, params) {
  const used = params.filter((p) => template.includes(`{${p.name}}`)).map((p) => ({ ...p, info: paramInfo(p) }));
  let body = template;
  for (const p of used) body = body.split(`{${p.name}}`).join('${' + p.info.expr + '}');
  const wire = used.length > 0 ? '`' + body + '`' : tsString(template);
  return { wire, used, usesClamp: used.some((p) => p.info.usesClamp) };
}

const generated = [];
let skipped = 0;

for (const spec of specs) {
  if (!spec || HANDWRITTEN.has(spec.controlType)) { skipped++; continue; }
  const className = ident(spec.className || `${spec.controlType}Control`);
  if (generated.some((g) => g.className === className || g.controlType === spec.controlType)) { skipped++; continue; }

  const usedNames = new Set(RESERVED); // methods and getters share one member namespace
  let usesClamp = false;
  let usesEpoch = false;
  const lines = [];
  const labelMaps = []; // module-level `Record<number, union>` consts for enum labels

  for (const cmd of spec.commands ?? []) {
    let method = ident(cmd.method);
    while (usedNames.has(method)) method += 'Command';
    usedNames.add(method);
    const { wire, used, usesClamp: c } = buildWire(cmd.template, cmd.params ?? []);
    if (c) usesClamp = true;
    const sig = used.map((p) => `${p.name}: ${p.info.tsType}`).join(', ');
    if (cmd.doc) lines.push(`  /** ${cmd.doc} */`);
    // Command methods resolve to void (they throw on a non-200 response); use the
    // ControlHandle.send() escape hatch when you need the raw response.
    lines.push(`  async ${method}(${sig}): Promise<void> {`, `    await this.send(${wire});`, `  }`);
  }

  for (const g of spec.getters ?? []) {
    let name = ident(g.name);
    while (usedNames.has(name)) name += 'Value';
    usedNames.add(name);
    if (g.doc) lines.push(`  /** ${g.doc} */`);
    lines.push(`  get ${name}(): ${TS_TYPE[g.kind]} | undefined {`, `    return this.${HELPER[g.kind]}(${tsString(g.state)});`, `  }`);

    // Pair a Loxone-epoch number with a Date getter (raw number getter kept).
    if (isEpochState(g)) {
      usesEpoch = true;
      let dn = dateGetterName(name);
      while (usedNames.has(dn)) dn += 'Value';
      usedNames.add(dn);
      lines.push(
        `  /** ${g.doc} (as a Date). */`,
        `  get ${dn}(): Date | undefined {`,
        `    const v = this.${HELPER[g.kind]}(${tsString(g.state)});`,
        `    // <= 0 is the Loxone "no timer / none" sentinel, not a real timestamp.`,
        `    return v === undefined || v <= 0 ? undefined : loxoneEpochToDate(v);`,
        `  }`,
      );
    }

    // Map a documented `N=Label` enum to a typed `${name}Label` getter (raw number kept).
    const enumEntries = g.kind === 'number' ? parseEnumLabels(g.doc) : null;
    if (enumEntries) {
      let labelName = `${name}Label`;
      while (usedNames.has(labelName)) labelName += 'Value';
      usedNames.add(labelName);
      const union = enumEntries.map(([, l]) => tsString(l)).join(' | ');
      const mapConst = `${labelName}Map`;
      labelMaps.push(
        `const ${mapConst}: Readonly<Record<number, ${union}>> = { ${enumEntries.map(([c, l]) => `[${c}]: ${tsString(l)}`).join(', ')} };`,
      );
      lines.push(
        `  /** ${g.doc.split(/[.(]/)[0].trim()} (decoded label). */`,
        `  get ${labelName}(): (${union}) | undefined {`,
        `    const v = this.${HELPER[g.kind]}(${tsString(g.state)});`,
        `    return v === undefined ? undefined : ${mapConst}[v];`,
        `  }`,
      );
    }

    // Parse a documented-JSON text state into a typed `${name}Json<T>()` (raw string kept).
    if (isJsonState(g)) {
      let jsonName = `${name}Json`;
      while (usedNames.has(jsonName)) jsonName += 'Value';
      usedNames.add(jsonName);
      lines.push(
        `  /** ${g.doc.split(/[.(]/)[0].trim()} (parsed JSON). */`,
        `  ${jsonName}<T = unknown>(): T | undefined {`,
        `    return this.control.getState(${tsString(g.state)})?.json<T>();`,
        `  }`,
      );
    }
  }

  const imports = [
    usesEpoch ? `import { loxoneEpochToDate } from '../../protocol/loxoneEpoch.js';` : '',
    `import { ${usesClamp ? 'clamp, ' : ''}ControlHandle } from '../ControlHandle.js';`,
  ].filter(Boolean).join('\n');

  const file = [
    imports,
    '',
    ...(labelMaps.length ? [...labelMaps, ''] : []),
    `/** ${spec.description || spec.controlType + ' control'} (generated). */`,
    `export class ${className} extends ControlHandle {`,
    `  static readonly controlType = ${tsString(spec.controlType)};`,
    ...(lines.length ? ['', ...lines] : []),
    `}`,
    '',
  ].join('\n');

  writeFileSync(join(OUT_DIR, `${className}.ts`), file);
  generated.push({ className, controlType: spec.controlType });
}

// Control types whose generated wrapper is extended by a hand-written subclass of
// the SAME class name in ../. The generated base file is still emitted (so the
// subclass can extend it), but the barrel, registry, and accessors must reference
// the hand subclass so consumers get the richer wrapper everywhere.
const HAND_EXTENDED = new Set(['Intercom', 'IntercomV2', 'Irrigation', 'WindowMonitor']);
const classImportPath = (g) => (HAND_EXTENDED.has(g.controlType) ? `../${g.className}.js` : `./${g.className}.js`);

// Barrel + registry contribution.
const sorted = generated.sort((a, b) => a.className.localeCompare(b.className));
const index = [
  '// Generated by scripts/codegen-controls.mjs — do not edit by hand.',
  `import type { ControlWrapperConstructor } from '../registry.js';`,
  ...sorted.map((g) => `import { ${g.className} } from '${classImportPath(g)}';`),
  '',
  ...sorted.map((g) => `export { ${g.className} } from '${classImportPath(g)}';`),
  '',
  `export const GENERATED_WRAPPERS: ControlWrapperConstructor[] = [`,
  ...sorted.map((g) => `  ${g.className},`),
  `];`,
  '',
].join('\n');
writeFileSync(join(OUT_DIR, 'index.ts'), index);

// Typed accessor surface: one `asX(target)` per generated wrapper, merged onto
// the client via declaration merging + a prototype install (see LoxoneClient).
// Skip accessors whose name would collide with a hand-written one — those
// control types are still reachable via wrap()/wrapAs() and their exported class.
const HAND_ACCESSORS = new Set([
  'asSwitch', 'asDimmer', 'asJalousie', 'asLightController', 'asGate', 'asWindow',
  'asPushbutton', 'asColorPicker', 'asRoomController', 'asInfoAnalog', 'asInfoDigital', 'asInfoText',
]);
const baseAccessorName = (className) => `as${className.replace(/Control$/, '')}`;
// If a generated accessor would collide with a hand-written one (the v1 controls
// whose v2 took the bare name), suffix it with V1 so every type still has an asX.
const accessorName = (className) => {
  const base = baseAccessorName(className);
  return HAND_ACCESSORS.has(base) ? `${base}V1` : base;
};
const accessorTargets = sorted; // every generated wrapper gets an accessor now
const accessors = [
  '// Generated by scripts/codegen-controls.mjs — do not edit by hand.',
  `import type { Uuid } from '../../protocol/messages/Uuid.js';`,
  `import type { Control } from '../../structure/Control.js';`,
  `import type { ControlWrapperConstructor } from '../registry.js';`,
  ...accessorTargets.map((g) => `import { ${g.className} } from '${classImportPath(g)}';`),
  '',
  '/** Typed `asX` accessors for the generated control wrappers (merged onto LoxoneClient). */',
  'export interface GeneratedControlAccessors {',
  ...accessorTargets.flatMap((g) => [
    `  /** Wraps a control as a typed {@link ${g.className}} (\`${g.controlType}\`), or \`undefined\`. */`,
    `  ${accessorName(g.className)}(target: string | Uuid | Control): ${g.className} | undefined;`,
  ]),
  '}',
  '',
  '/** Accessor method name → wrapper constructor, used to install the accessors at runtime. */',
  'export const GENERATED_ACCESSORS: Readonly<Record<string, ControlWrapperConstructor>> = {',
  ...accessorTargets.map((g) => `  ${accessorName(g.className)}: ${g.className},`),
  '};',
  '',
].join('\n');
writeFileSync(join(OUT_DIR, 'accessors.ts'), accessors);

console.log(`Generated ${generated.length} wrappers + accessors (skipped ${skipped}).`);
