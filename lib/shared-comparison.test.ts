import { describe, expect, it } from 'vitest';

import { DATASET_VERSION, formatPercent, formatUSD } from '@/engine';

import { cardFilename, cardPath } from './share-card';
import { decodeComparison, encodeComparison, type SharedComparison } from './share-link';
import {
  comparisonFromShared,
  describeComparison,
  describeHousehold,
  jurisdictionsFor,
} from './shared-comparison';

const CHICAGO_TO_AUSTIN: SharedComparison = {
  datasetVersion: '2026.1',
  filingStatus: 'single',
  children: 0,
  origin: {
    metroId: '16980',
    grossSalary: 150_000,
    cars: 1,
    localOptIns: {},
    housing: { tenure: 'rent', monthlyRent: 1_430 },
  },
  destination: {
    metroId: '12420',
    grossSalary: 125_000,
    cars: 1,
    localOptIns: {},
    housing: { tenure: 'rent', monthlyRent: 1_726 },
  },
};

describe('comparisonFromShared', () => {
  it('computes a decoded link', () => {
    const result = comparisonFromShared(CHICAGO_TO_AUSTIN);
    expect(result.delta).toBeLessThan(0); // a $25K pay cut into a cheaper city
    expect(result.origin.metroId).toBe('16980');
    expect(result.destination.tax.state).toBe(0); // Texas
  });

  /*
   * The link says 2026.1; the answer is today's. The page computes at the
   * current release, so the preview and the card have to as well, or an old
   * link quotes one figure in the chat and another on the page it opens.
   */
  it('answers an old link with the current release, as the page does', () => {
    const result = comparisonFromShared(CHICAGO_TO_AUSTIN);
    expect(result.datasetVersion).toBe(DATASET_VERSION);
    const asIfNew = comparisonFromShared({ ...CHICAGO_TO_AUSTIN, datasetVersion: DATASET_VERSION });
    expect(result.delta).toBe(asIfNew.delta);
  });

  it('never prints a version it did not compute with', () => {
    // A forged or future version used to be carried onto the card's footer
    // while the numbers came from the current release.
    expect(comparisonFromShared({ ...CHICAGO_TO_AUSTIN, datasetVersion: '2099.1' }).datasetVersion).toBe(
      DATASET_VERSION,
    );
  });

  it('a link round trip produces an identical result', () => {
    const direct = comparisonFromShared(CHICAGO_TO_AUSTIN);
    const viaLink = comparisonFromShared(decodeComparison(encodeComparison(CHICAGO_TO_AUSTIN)));
    expect(viaLink.delta).toBeCloseTo(direct.delta, 6);
    expect(viaLink.breakEvenSalary).toBeCloseTo(direct.breakEvenSalary!, 6);
  });
});

describe('describeHousehold', () => {
  it('names the filing status, the children and the tenure', () => {
    expect(describeHousehold(CHICAGO_TO_AUSTIN)).toBe('Single · no children · renting');
  });

  /*
   * A card that shows a couple's combined salary without saying it is combined
   * invites the reader to hold it against their own single wage. The earner
   * count also changes the money, so it belongs on the assumptions line.
   */
  it('says when two people are earning the salary', () => {
    const couple: SharedComparison = { ...CHICAGO_TO_AUSTIN, filingStatus: 'marriedJointly' };
    expect(describeHousehold({ ...couple, earners: 2 })).toContain('Married, jointly, both earning');
    expect(describeHousehold({ ...couple, earners: 1 })).toContain('Married, jointly ·');
    expect(describeHousehold(couple)).toContain('Married, jointly ·');
  });

  it('does not claim two earners for a household that has one adult', () => {
    // Old links can carry a stale count from before the status changed.
    expect(describeHousehold({ ...CHICAGO_TO_AUSTIN, earners: 2 })).toBe(
      'Single · no children · renting',
    );
  });

  it('counts one child in the singular', () => {
    expect(describeHousehold({ ...CHICAGO_TO_AUSTIN, children: 1 })).toContain('1 child ');
    expect(describeHousehold({ ...CHICAGO_TO_AUSTIN, children: 2 })).toContain('2 children');
  });

  it('says buying when the housing is owned', () => {
    const owning: SharedComparison = {
      ...CHICAGO_TO_AUSTIN,
      filingStatus: 'marriedJointly',
      children: 2,
      origin: {
        ...CHICAGO_TO_AUSTIN.origin,
        housing: {
          tenure: 'own',
          homePrice: 400_000,
          downPayment: 0.2,
          mortgageRate: 0.068,
          propertyTaxRate: 0.019,
        },
      },
      destination: {
        ...CHICAGO_TO_AUSTIN.destination,
        housing: {
          tenure: 'own',
          homePrice: 500_000,
          downPayment: 0.2,
          mortgageRate: 0.068,
          propertyTaxRate: 0.017,
        },
      },
    };
    expect(describeHousehold(owning)).toBe('Married, jointly · 2 children · buying');
  });

  it('reports both when a link renders in one city and owns in the other', () => {
    // The form moves the two together, but the wire format stores one tenure
    // per city — so a hand-built link can differ, and saying only the first
    // would misdescribe half the calculation.
    const mixed: SharedComparison = {
      ...CHICAGO_TO_AUSTIN,
      destination: {
        ...CHICAGO_TO_AUSTIN.destination,
        housing: {
          tenure: 'own',
          homePrice: 500_000,
          downPayment: 0.2,
          mortgageRate: 0.068,
          propertyTaxRate: 0.017,
        },
      },
    };
    expect(describeHousehold(mixed)).toContain('renting → buying');
  });
});

describe('jurisdictionsFor', () => {
  it('applies New York City only when the user opted in', () => {
    const inCity = jurisdictionsFor({
      ...CHICAGO_TO_AUSTIN.origin,
      metroId: '35620',
      localOptIns: { nyc: true, yonkers: false },
    });
    expect(inCity.map((j) => j.id)).toContain('nyc');

    const suburb = jurisdictionsFor({
      ...CHICAGO_TO_AUSTIN.origin,
      metroId: '35620',
      localOptIns: { nyc: false, yonkers: false },
    });
    expect(suburb).toHaveLength(0);
  });

  it('applies non-optional local taxes without asking', () => {
    // Philadelphia's metro carries Pennsylvania's local tax by default.
    const philadelphia = jurisdictionsFor({ ...CHICAGO_TO_AUSTIN.origin, metroId: '37980' });
    expect(philadelphia.length).toBeGreaterThan(0);
  });

  it('is empty for the vast majority of metros', () => {
    expect(jurisdictionsFor({ ...CHICAGO_TO_AUSTIN.destination, metroId: '12420' })).toHaveLength(0);
  });
});

describe('describeComparison', () => {
  const summary = describeComparison(comparisonFromShared(CHICAGO_TO_AUSTIN));

  /*
   * The figures are read off the result rather than written in: the link is
   * answered at the current release, so they move with every data refresh. What
   * these pin is the wording around them.
   */
  const result = comparisonFromShared(CHICAGO_TO_AUSTIN);
  const breakEven = result.breakEvenSalary!;

  it('states the direction and the amount in the title', () => {
    expect(summary.title).toBe(
      `Chicago, IL → Austin, TX: ${formatUSD(Math.abs(result.delta))} a year worse off`,
    );
  });

  it('puts the actionable break-even figure in the description', () => {
    // Says which side of the offer it falls on. "Break-even salary: $139,163"
    // alone left the reader to subtract the salary themselves to find out
    // whether that was good news or bad — and here it is bad, matching the
    // "worse off" title rather than reading against it.
    expect(summary.description).toContain(formatUSD(breakEven));
    // The gap and what it is measured against are abbreviated: a link preview
    // is truncated at about 150 characters, so every digit spent on precision
    // nobody quotes is a word of the sentence that gets cut.
    expect(summary.description).toContain(
      `${formatUSD(breakEven - 125_000)} more than the $125K you'd be paid there`,
    );
    expect(summary.description).toContain(`${formatPercent(Math.abs(result.deltaPct))} less spare cash`);
  });

  it('drops the percentage when the origin city leaves nothing to measure', () => {
    const struggling = {
      ...CHICAGO_TO_AUSTIN,
      filingStatus: 'marriedJointly' as const,
      children: 2,
      origin: { ...CHICAGO_TO_AUSTIN.origin, grossSalary: 60_000 },
      destination: { ...CHICAGO_TO_AUSTIN.destination, grossSalary: 60_000 },
    };
    const description = describeComparison(comparisonFromShared(struggling)).description;
    expect(description).not.toMatch(/spare cash/);
    expect(description).toMatch(/a month/);
  });

  it('says "better off" when the move wins', () => {
    const sameSalary = {
      ...CHICAGO_TO_AUSTIN,
      destination: { ...CHICAGO_TO_AUSTIN.destination, grossSalary: 150_000 },
    };
    expect(describeComparison(comparisonFromShared(sameSalary)).title).toMatch(/better off/);
  });

  it('produces a filename-safe slug with no punctuation', () => {
    expect(summary.slug).toBe('chicago-il-to-austin-tx');
    expect(cardFilename(summary.slug)).toBe('chicago-il-to-austin-tx-packorstay.png');
  });

  it('handles rural locations in the slug', () => {
    const rural = {
      ...CHICAGO_TO_AUSTIN,
      destination: { ...CHICAGO_TO_AUSTIN.destination, metroId: 'rest-of-MT' },
    };
    const slug = describeComparison(comparisonFromShared(rural)).slug;
    expect(slug).toBe('chicago-il-to-rest-of-montana');
    expect(slug).toMatch(/^[a-z0-9-]+$/);
  });
});

describe('cardPath', () => {
  it('points at the one image used for both previews and downloads', () => {
    const payload = encodeComparison(CHICAGO_TO_AUSTIN);
    expect(cardPath(payload)).toBe(`/api/card/${payload}`);
  });
});
