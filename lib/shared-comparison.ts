/**
 * Turning a decoded share link into a computed result, and into words.
 *
 * Three places need this: the page, the link-preview metadata, and the card
 * image. Keeping it here means a shared link, its preview text and its picture
 * can never disagree about what the answer is.
 */

import {
  breakEvenSentence,
  compare,
  DATASET_VERSION,
  formatPercent,
  formatUSD,
  metro,
  resolveLocalJurisdictions,
  resolveStateCode,
  percentIsMeaningful,
  type ComparisonResult,
} from '@/engine';
import type { SharedCity, SharedComparison } from '@/lib/share-link';

/** The local jurisdictions a city's opt-in choices resolve to. */
export function jurisdictionsFor(city: SharedCity, version?: string) {
  return resolveLocalJurisdictions(
    city.metroId,
    city.localOptIns,
    version,
    // Narrowed to the state they actually live in: New York City's resident
    // tax must not reach the New Jersey half of the New York metro.
    resolveStateCode(city.metroId, city.stateCode, version),
  );
}

/**
 * A shared link, computed against TODAY'S data — not the release it was made with.
 *
 * The link still carries the version it was made with, and this used to replay
 * it. But only the preview text and the card ever did: the answer screen has
 * always computed at the current release, because pulling an old release into
 * the browser is the 0.6MB-per-version cost the dataset split removed. So an
 * old link said "$9,392 a year better off" in its preview and on its card and
 * "+$9,144" on the page it opened. Three surfaces, two answers.
 *
 * The decision (2026-10-01) is that an old link showing new numbers is fine —
 * the inputs are the sender's, the prices and taxes are this year's, which is
 * also what the reader would get by typing the same thing in. What is not fine
 * is the page, its preview and its picture disagreeing. So all three compute
 * here, at the current release, and agree by construction.
 */
export function comparisonFromShared(input: SharedComparison): ComparisonResult {
  return compare(
    {
      datasetVersion: DATASET_VERSION,
      household: {
        filingStatus: input.filingStatus,
        children: input.children,
        earners: input.earners,
      },
      origin: input.origin,
      destination: input.destination,
    },
    {
      origin: { localJurisdictions: jurisdictionsFor(input.origin) },
      destination: { localJurisdictions: jurisdictionsFor(input.destination) },
    },
  );
}

const FILING_WORDS: Record<SharedComparison['filingStatus'], string> = {
  single: 'Single',
  marriedJointly: 'Married, jointly',
  marriedSeparately: 'Married, separately',
  headOfHousehold: 'Head of household',
};

/**
 * The assumptions a result rests on, in one line: "Single · no children · renting".
 *
 * A figure like "+$8,967 a year" is meaningless without them — it is an answer
 * for a particular household at a particular salary, and a card or a preview
 * that shows only the answer invites the reader to apply it to themselves. This
 * lives beside describeComparison so the picture and the words cannot disagree.
 */
export function describeHousehold(input: SharedComparison): string {
  const children =
    input.children === 0
      ? 'no children'
      : input.children === 1
        ? '1 child'
        : `${input.children} children`;

  // The form moves both cities together, but the link format stores a tenure
  // per city, so a hand-built link can legitimately differ. Say so rather than
  // reporting whichever one happens to be first.
  const from = input.origin.housing.tenure;
  const to = input.destination.housing.tenure;
  const word = (t: 'rent' | 'own') => (t === 'rent' ? 'renting' : 'buying');
  const tenure = from === to ? word(from) : `${word(from)} → ${word(to)}`;

  /*
   * Whether one or two people earn the salary is an assumption on the same
   * footing as the rest of this line, not a detail. It moves the Social
   * Security cap, and for a couple filing separately it decides whether the
   * figure is run through one return or two. Only worth saying for couples —
   * a single filer and a head of household are one earner by definition.
   */
  const status = FILING_WORDS[input.filingStatus];
  const both =
    (input.filingStatus === 'marriedJointly' || input.filingStatus === 'marriedSeparately') &&
    (input.earners ?? 1) >= 2;

  return `${status}${both ? ', both earning' : ''} · ${children} · ${tenure}`;
}

export interface ComparisonSummary {
  title: string;
  description: string;
  /** Safe for a filename: "chicago-il-to-austin-tx". */
  slug: string;
}

/** Plain-language summary, used for link previews and the download filename. */
export function describeComparison(result: ComparisonResult): ComparisonSummary {
  const from = metro(result.origin.metroId).shortName;
  const to = metro(result.destination.metroId).shortName;
  const better = result.delta >= 0;
  const amount = formatUSD(Math.abs(result.delta));

  const slugify = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  // The percentage is measured against leftover money in the origin city, so
  // it says nothing when there is none. The monthly figure always holds.
  const spare = percentIsMeaningful(result)
    ? `${formatPercent(Math.abs(result.deltaPct))} ${better ? 'more' : 'less'} spare cash, `
    : '';
  const breakEven = breakEvenSentence(result);

  return {
    title: `${from} → ${to}: ${amount} a year ${better ? 'better off' : 'worse off'}`,
    description:
      `${spare}${formatUSD(Math.abs(result.deltaMonthly))} a month. ` +
      (breakEven ? `${breakEven} ` : '') +
      `Income tax, property tax, housing, cars and cost of living, from public data.`,
    slug: `${slugify(from)}-to-${slugify(to)}`,
  };
}
