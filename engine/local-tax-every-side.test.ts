/**
 * EVERY SIDE OF EVERY METRO GETS ITS STATE'S LOCAL INCOME TAX.
 *
 * The build attached local taxes by a metro's PRIMARY state only, and the
 * engine narrows a metro's taxes to the state the reader actually lives in.
 * So every other side of a split metro paid nothing: the Maryland side of
 * Washington — Montgomery and Prince George's, both at 3.20% — and of
 * Philadelphia; the Kentucky sides of Cincinnati, Clarksville and
 * Huntington; the Iowa side of Omaha; the Ohio sides of Huntington, Wheeling
 * and Weirton. Every one of those states charges a local tax in every other
 * metro it has.
 *
 * This sweeps every metro against every state it spans, through the same
 * resolver the calculator uses with nobody's choices filled in, and insists
 * that a state with a local income tax never comes back empty — unless the
 * release itself documents why.
 *
 * THE DOCUMENTED EXCEPTIONS are the states whose local tax is levied by
 * particular cities rather than everywhere: New York (New York City and
 * Yonkers only), and Missouri, Oregon, Michigan and Alabama. A metro in one of
 * those states without a taxing city correctly carries nothing, and the
 * release's own limitations say so. Every other state on the list is checked
 * without exception.
 */

import { describe, expect, it } from 'vitest';

import { CURRENT_DATASET_VERSION, datasetBundle } from './datasets';
import { allLocalJurisdictions, allMetros, resolveLocalJurisdictions } from './dataset';

const version = CURRENT_DATASET_VERSION;

/** Full state names, as the release's limitations spell them. */
const CITY_SPECIFIC: Record<string, string> = {
  NY: 'New York',
  MO: 'Missouri',
  OR: 'Oregon',
  MI: 'Michigan',
  AL: 'Alabama',
};

/** Every state that has any local income tax in this release. */
const TAXING_STATES = new Set(allLocalJurisdictions(version).map((j) => j.stateCode));

describe(`local income tax on every side of a metro, ${CURRENT_DATASET_VERSION}`, () => {
  const pairs = allMetros(version).flatMap((m) => m.states.map((state) => ({ metro: m, state })));

  it('covers the states it should be checking', () => {
    // A sweep over nothing would pass. These are the states the release says
    // levy a local income tax; if one vanished, the sweep would quietly shrink.
    for (const s of ['IN', 'MD', 'OH', 'PA', 'KY', 'IA', 'NY', 'MO', 'MI', 'AL', 'OR']) {
      expect(TAXING_STATES.has(s), s).toBe(true);
    }
  });

  it('never resolves a state with a statewide local tax to none', () => {
    const missing = pairs
      .filter(({ state }) => TAXING_STATES.has(state) && !CITY_SPECIFIC[state])
      .filter(({ metro, state }) => resolveLocalJurisdictions(metro.id, {}, version, state).length === 0)
      .map(({ metro, state }) => `${metro.id} ${metro.name} (${state} side)`);

    expect(missing).toEqual([]);
  });

  it('documents every state where a metro may legitimately carry none', () => {
    const limitations = (datasetBundle(version).localTax.limitations as string[]).join(' ');
    const exempted = new Set(
      pairs
        .filter(({ state }) => CITY_SPECIFIC[state])
        .filter(({ metro, state }) => resolveLocalJurisdictions(metro.id, {}, version, state).length === 0)
        .map(({ state }) => state),
    );
    for (const state of exempted) {
      expect(limitations, state).toContain(CITY_SPECIFIC[state]);
    }
  });

  it('charges only taxes from the state the reader lives in', () => {
    for (const { metro, state } of pairs) {
      for (const j of resolveLocalJurisdictions(metro.id, {}, version, state)) {
        expect(j.stateCode, `${metro.id} ${state} -> ${j.id}`).toBe(state);
      }
    }
  });

  it.each([
    ['47900', 'MD', 'md-47900'], // Washington: Montgomery, Prince George's, Charles, Frederick
    ['37980', 'MD', 'md-37980'], // Philadelphia: Cecil County
    ['17140', 'KY', 'avg-KY'], // Cincinnati: Northern Kentucky
    ['17300', 'KY', 'avg-KY'], // Clarksville
    ['26580', 'KY', 'avg-KY'], // Huntington-Ashland
    ['26580', 'OH', 'avg-OH'],
    ['48540', 'OH', 'avg-OH'], // Wheeling
    ['48260', 'OH', 'avg-OH'], // Weirton-Steubenville
    ['36540', 'IA', 'avg-IA'], // Omaha: Council Bluffs
  ])('%s, %s side, carries %s', (metroId, state, id) => {
    expect(resolveLocalJurisdictions(metroId, {}, version, state).map((j) => j.id)).toEqual([id]);
  });
});
