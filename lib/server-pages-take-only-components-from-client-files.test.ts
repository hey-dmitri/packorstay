/**
 * A server page may import a COMPONENT from a 'use client' file, and nothing else.
 *
 * The methodology page imported DEFAULT_SALARY from lib/use-comparison-form.ts,
 * which is a client module. Across that boundary a server component does not
 * get the value: it gets a client reference, an opaque stand-in that only means
 * something to React when rendered as an element. formatUSD() of it is NaN, so
 * the live page told every reader "the box opens on the US median of $NaN".
 *
 * Nothing caught it. The types say it is a number, the build is happy, and the
 * page renders — just with the wrong text. So this reads the imports directly:
 * every name a server file takes from a client file must be a component
 * (PascalCase — and note DEFAULT_SALARY is capitalised too, so a bare capital
 * is not enough), a type, or nothing at all.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const isClient = (source: string) => /^\s*(['"])use client\1/.test(source);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(name) && !name.endsWith('.test.ts') ? [path] : [];
  });
}

/** '@/lib/x' -> absolute path of the .ts or .tsx it names, if it is ours. */
function resolveAlias(specifier: string): string | null {
  if (!specifier.startsWith('@/')) return null;
  const base = join(ROOT, specifier.slice(2));
  for (const ext of ['.ts', '.tsx']) {
    try {
      statSync(base + ext);
      return base + ext;
    } catch {
      // try the next extension
    }
  }
  return null;
}

const serverFiles = walk(join(ROOT, 'app')).filter((f) => !isClient(readFileSync(f, 'utf8')));

describe('server files importing from client files', () => {
  it('finds the server pages to check', () => {
    expect(serverFiles.length).toBeGreaterThan(4);
  });

  for (const file of serverFiles) {
    it(`${relative(ROOT, file)} takes only components across the boundary`, () => {
      const source = readFileSync(file, 'utf8');
      const offenders: string[] = [];

      for (const match of source.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s+from\s+'([^']+)'/g)) {
        if (match[1]) continue; // `import type { … }` is erased
        const target = resolveAlias(match[3]);
        if (!target || !isClient(readFileSync(target, 'utf8'))) continue;

        for (const raw of match[2].split(',')) {
          const name = raw.trim();
          if (!name || name.startsWith('type ')) continue;
          const local = name.split(/\s+as\s+/).pop()!;
          if (!/^[A-Z][a-z]/.test(local)) offenders.push(`${local} from ${match[3]}`);
        }
      }

      expect(offenders).toEqual([]);
    });
  }
});
