/**
 * What a money box makes of what somebody typed or pasted into it.
 *
 * It used to keep every digit and drop everything else, which is right for
 * "$120,000" and badly wrong for "$120,000.00": the decimal point went and the
 * cents stayed, so a salary pasted from an offer letter or a payslip arrived a
 * hundred times too large. Every box on the site is whole dollars, so the
 * cents are read as cents and rounded away.
 *
 * Empty, or nothing numeric at all, is 0 — which the box shows as blank.
 */
export function typedDollars(text: string): number {
  const cleaned = text.replace(/[^0-9.]/g, '');
  if (!/\d/.test(cleaned)) return 0;

  // Only the first point is a decimal point; anything after a second one is
  // noise, not more cents.
  const [whole, fraction = ''] = cleaned.split('.');
  const dollars = Number(whole || '0');
  return fraction ? Math.round(Number(`${dollars}.${fraction.replace(/\./g, '')}`)) : dollars;
}
