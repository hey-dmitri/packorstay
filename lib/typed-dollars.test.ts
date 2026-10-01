import { describe, expect, it } from 'vitest';

import { typedDollars } from './typed-dollars';

describe('typedDollars', () => {
  it('reads plain and formatted whole dollars', () => {
    expect(typedDollars('120000')).toBe(120_000);
    expect(typedDollars('$120,000')).toBe(120_000);
    expect(typedDollars(' 1,850 ')).toBe(1_850);
  });

  it('does not turn pasted cents into extra digits', () => {
    // Was 12,000,000.
    expect(typedDollars('$120,000.00')).toBe(120_000);
    expect(typedDollars('1,850.40')).toBe(1_850);
    expect(typedDollars('1,850.50')).toBe(1_851);
  });

  it('survives a trailing point while somebody is still typing', () => {
    expect(typedDollars('120000.')).toBe(120_000);
    expect(typedDollars('.5')).toBe(1);
  });

  it('treats empty or wordy input as nothing', () => {
    expect(typedDollars('')).toBe(0);
    expect(typedDollars('$')).toBe(0);
    expect(typedDollars('.')).toBe(0);
    expect(typedDollars('abc')).toBe(0);
  });
});
