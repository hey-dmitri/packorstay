/**
 * MARYLAND'S COUNTY TAX IS CHARGED ON MARYLAND TAXABLE INCOME.
 *
 * "Local tax is based on taxable income and not on Maryland state tax" — the
 * Comptroller's 2026 withholding facts. Baltimore City's 3.20% and the
 * statewide average were both charged on gross pay, and the data said so in
 * a note. Both now use the state's taxable income, the way Indiana's counties
 * already did, and the statewide average is rebuilt from what the counties
 * levy rather than Tax Foundation's share-of-AGI figure, which would have
 * taken the deduction off twice on this base.
 */

import { describe, expect, it } from 'vitest';

import { computeCity } from './compare';
import { localJurisdiction, resolveLocalJurisdictions } from './dataset';
import type { FilingStatus } from './types';

const BALTIMORE = '12580';

const renter = (metroId: string, grossSalary: number) => ({
  metroId,
  stateCode: 'MD',
  grossSalary,
  cars: 1,
  housing: { tenure: 'rent' as const, monthlyRent: 2_000 },
});

const household = (filingStatus: FilingStatus, children = 0) => ({ filingStatus, children });

describe('Maryland county tax base', () => {
  it('charges both Maryland options on state taxable income', () => {
    for (const id of ['baltimore-city', 'avg-MD']) {
      const j = localJurisdiction(id);
      expect(j.kind, id).toBe('flatRate');
      if (j.kind === 'flatRate') expect(j.appliesTo, id).toBe('stateTaxableIncome');
    }
  });

  it('Baltimore City, single on $100,000: 3.2% of $93,400, not of $100,000', () => {
    const r = computeCity(renter(BALTIMORE, 100_000), household('single'));
    /*
     * $100,000 - $3,400 Maryland standard deduction - $3,200 exemption
     * = $93,400 of Maryland taxable income. 3.2% of it is $2,988.80.
     * On gross it was $3,200.
     */
    expect(r.tax.local).toBeCloseTo(0.032 * 93_400, 6);
    expect(r.tax.local).toBeCloseTo(2_988.8, 6);
  });

  it('a family pays less than a single person on the same pay, because their exemptions come off first', () => {
    const single = computeCity(renter(BALTIMORE, 100_000), household('single'));
    const family = computeCity(renter(BALTIMORE, 100_000), household('marriedJointly', 2));
    /*
     * Joint: $100,000 - $6,700 - 4 x $3,200 = $80,500. At 3.2%, $2,576.
     * On gross, the two were charged the same $3,200.
     */
    expect(family.tax.local).toBeCloseTo(0.032 * 80_500, 6);
    expect(family.tax.local).toBeLessThan(single.tax.local);
  });

  it("the statewide average is the counties' levied rates, not an effective rate on AGI", () => {
    const avg = localJurisdiction('avg-MD');
    if (avg.kind !== 'flatRate') throw new Error('avg-MD should be a flat rate');
    // Every Maryland county levies between 2.25% and 3.30%; most sit at 3.20%.
    // Tax Foundation's 2.40% is below all but three of them, because it is
    // measured on a broader base than this one is charged on.
    expect(avg.rate).toBeGreaterThan(0.03);
    expect(avg.rate).toBeLessThan(0.032);
  });

  it('a Baltimore link that chose "elsewhere in the metro" still resolves to the average', () => {
    // The id is kept for exactly this: share links store the choice by id.
    const [applied] = resolveLocalJurisdictions(BALTIMORE, { 'avg-MD': true }, undefined, 'MD');
    expect(applied.id).toBe('avg-MD');
  });
});
