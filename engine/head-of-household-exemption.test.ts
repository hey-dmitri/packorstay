/**
 * A HEAD OF HOUSEHOLD GETS ONE PERSONAL EXEMPTION, NOT A COUPLE'S TWO.
 *
 * Maryland, Oklahoma and New Jersey send a head of household to their JOINT
 * rate table, and publish no head-of-household exemption of their own. The
 * engine looked the exemption up on the same key as the rate table, so a
 * single parent was handed the joint figure — the exemption for a spouse
 * they do not have. Each state's form lists it as "yourself", plus "spouse"
 * only on a joint return.
 *
 * Every figure below is worked by hand from the state's own published
 * numbers, not read back from the engine. One child, $60,000 of wages, which
 * is above every earned-income credit these states pay, so nothing but the
 * deduction, the exemptions and the rate table is in play.
 */

import { describe, expect, it } from 'vitest';

import { stateRules } from './tax/rules';
import { computeStateTax } from './tax/state';

const singleParent = (code: string, grossSalary = 60_000) =>
  computeStateTax({ grossSalary, filingStatus: 'headOfHousehold', children: 1 }, stateRules(code));

describe('head of household personal exemption', () => {
  it('Maryland: $3,200 for the parent plus $3,200 for the child', () => {
    const r = singleParent('MD');
    expect(r.exemptions).toBe(6_400);
    /*
     * $60,000 - $6,700 (the joint/head-of-household standard deduction)
     *         - $6,400 (two exemptions: parent and child)  = $46,900.
     * Joint table: $90 on the first $3,000, then 4.75% of $43,900 = $2,085.25.
     * Was $2,023.25, on $43,700 after three exemptions.
     */
    expect(r.taxableIncome).toBe(46_900);
    expect(r.tax).toBeCloseTo(90 + 0.0475 * 43_900, 6);
    expect(r.tax).toBeCloseTo(2_175.25, 6);
  });

  it('Oklahoma: $1,000 for the parent plus $1,000 for the child', () => {
    const r = singleParent('OK');
    expect(r.exemptions).toBe(2_000);
    /*
     * $60,000 - $9,350 (Oklahoma's own head-of-household deduction)
     *         - $2,000 = $48,650.
     * Joint table: 0% to $7,500, 2.5% of $2,300, 3.5% of $4,600, then 4.5% of
     * $34,250 = $57.50 + $161 + $1,541.25 = $1,759.75. Was $1,714.75.
     */
    expect(r.taxableIncome).toBe(48_650);
    expect(r.tax).toBeCloseTo(1_759.75, 6);
  });

  it('New Jersey: $1,000 for the parent plus $1,500 for the child', () => {
    const r = singleParent('NJ');
    expect(r.exemptions).toBe(2_500);
    /*
     * No standard deduction in New Jersey. $60,000 - $2,500 = $57,500.
     * Table B: 1.4% of $20,000, 1.75% of $30,000, 2.45% of $7,500
     * = $280 + $525 + $183.75 = $988.75. Was $964.25.
     */
    expect(r.taxableIncome).toBe(57_500);
    expect(r.tax).toBeCloseTo(988.75, 6);
  });

  it('a married couple still gets two', () => {
    for (const [code, joint] of [['MD', 6_400], ['OK', 2_000], ['NJ', 2_000]] as const) {
      const r = computeStateTax(
        { grossSalary: 60_000, filingStatus: 'marriedJointly', children: 0 },
        stateRules(code),
      );
      expect(r.exemptions, code).toBe(joint);
    }
  });

  /*
   * The engine change, not just the data. A state that sends a head of
   * household to its joint table and publishes no head-of-household exemption
   * must still get the single figure, so the next state added with the same
   * shape cannot repeat this.
   */
  it('falls back to one person, not to the joint figure, where no head-of-household figure is published', () => {
    const rules = stateRules('MD');
    const withoutHoh = {
      ...rules,
      personalExemption: { ...rules.personalExemption, headOfHousehold: undefined },
    };
    const r = computeStateTax(
      { grossSalary: 60_000, filingStatus: 'headOfHousehold', children: 1 },
      withoutHoh,
    );
    expect(r.exemptions).toBe(6_400);
  });
});
