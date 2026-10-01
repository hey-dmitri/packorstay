/**
 * The release a fresh visit computes with, and the ONLY one bundled eagerly.
 *
 * It lives in its own module so that cutting a release is a whole-file rewrite
 * of nine lines rather than a surgical edit inside a registry — see
 * scripts/cut-dataset-version.mjs, which regenerates this from a template.
 *
 * Everything else is behind a dynamic import in ./datasets. Static imports of
 * all of them put 14.7MB of JSON in every bundle and parsed it on every cold
 * start, to answer a question that only ever needs one release at a time.
 */

import federal202630 from '../data/2026.30/federal.json';
import housing202630 from '../data/2026.30/housing.json';
import localTax202630 from '../data/2026.30/local-income-tax.json';
import metros202630 from '../data/2026.30/metros.json';
import salesTax202630 from '../data/2026.30/sales-tax.json';
import spending202630 from '../data/2026.30/spending.json';
import states202630 from '../data/2026.30/states.json';
import transport202630 from '../data/2026.30/transport.json';

/**
 * What a fresh visit computes with. Bumping this is the ONLY edit a new dataset
 * release needs on the engine side — everything downstream reads it from here,
 * which is what the two hardcoded boundary modules failed to provide.
 */
export const CURRENT_DATASET_VERSION = '2026.30';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const CURRENT_BUNDLE = {
  version: CURRENT_DATASET_VERSION,
  federal: federal202630 as any,
  housing: housing202630 as any,
  localTax: localTax202630 as any,
  metros: metros202630 as any,
  salesTax: salesTax202630 as any,
  spending: spending202630 as any,
  states: states202630 as any,
  transport: transport202630 as any,
};
