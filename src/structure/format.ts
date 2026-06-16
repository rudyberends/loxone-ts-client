/**
 * Best-effort formatting of a numeric state value using a Loxone format string.
 *
 * Loxone format strings are C `printf`-style, e.g. `"%.1f°C"`, `"%.0f %%"`,
 * `"%i"`. This applies the first numeric conversion to `value` and resolves `%%`
 * to a literal `%`. Anything it doesn't understand is left as-is.
 */
export function formatLoxoneValue(value: number, format: string | undefined): string {
  if (!format) return String(value);

  let applied = false;
  const out = format.replace(/%%|%[-+ 0]*\d*(?:\.(\d+))?([fdis])/g, (match, precision: string | undefined, conv: string) => {
    applied = true;
    if (match === '%%') return '%';
    switch (conv) {
      case 'f':
        return precision !== undefined ? value.toFixed(parseInt(precision, 10)) : String(value);
      case 'd':
      case 'i':
        return String(Math.round(value));
      default:
        return String(value);
    }
  });

  // If the format carried no numeric placeholder, we can't meaningfully apply it.
  return applied ? out : String(value);
}
