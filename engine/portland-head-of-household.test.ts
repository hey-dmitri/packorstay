/**
 * A HEAD OF HOUSEHOLD IN MULTNOMAH COUNTY IS ON THE JOINT THRESHOLDS.
 *
 * The Portland Revenue Division, which administers both Portland-area income
 * taxes, lists head of household among the joint filing statuses for the
 * Preschool for All tax as well as for the Metro housing tax
 * (https://www.portland.gov/revenue/personal-tax). The Metro tax carried a
 * head-of-household schedule; Preschool for All did not, so the engine fell
 * back to the single one and charged a single parent from $125,000 instead of
 * $200,000.
 */

import { describe, expect, it } from 'vitest';

import { localJurisdiction } from './dataset';
import { computeLocalTax } from './tax/local';

const preschool = localJurisdiction('portland-multnomah');

const taxAt = (filingStatus: 'single' | 'marriedJointly' | 'headOfHousehold', taxable: number) =>
  computeLocalTax(
    { grossSalary: taxable, filingStatus, children: 1, stateTax: 0, stateTaxableIncome: taxable },
    preschool,
  ).tax;

describe('Preschool for All, head of household', () => {
  it('carries its own schedule, the same as the joint one', () => {
    expect(preschool.kind).toBe('bracketed');
    if (preschool.kind !== 'bracketed') return;
    expect(preschool.brackets.headOfHousehold).toEqual(preschool.brackets.marriedJointly);
  });

  it('charges a single parent on $220,000 of Oregon taxable income $300, not $1,425', () => {
    // 1.5% of the $20,000 above the joint $200,000 threshold.
    expect(taxAt('headOfHousehold', 220_000)).toBeCloseTo(300, 6);
    // The single schedule is untouched: 1.5% of $95,000 over $125,000.
    expect(taxAt('single', 220_000)).toBeCloseTo(1_425, 6);
  });

  it('reaches the 3% band at $400,000, as a joint return does', () => {
    // 1.5% of $200,000 between the thresholds, plus 3% of the $50,000 above.
    expect(taxAt('headOfHousehold', 450_000)).toBeCloseTo(3_000 + 1_500, 6);
    expect(taxAt('headOfHousehold', 450_000)).toBeCloseTo(taxAt('marriedJointly', 450_000), 6);
  });
});
