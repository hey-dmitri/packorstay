'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/**
 * What a page shows when something throws while it renders.
 *
 * There was no error boundary anywhere in the app. A well-formed share link
 * naming a place that does not exist decoded fine and then threw inside the
 * answer screen — and with nothing to catch it, the page stayed on its loading
 * skeleton for good: no answer, no message, no way out but the back button.
 * The decoder now refuses that link up front, but the next unforeseen throw
 * should land here rather than on a skeleton that never resolves.
 *
 * Shaped like the "That link didn't work" box on the shared page, because to
 * the reader it is the same kind of moment. The error's own message is not
 * shown: in production a server error arrives as a generic string with a
 * digest, and a client one may be an engine message written for developers.
 *
 * `retry`, not `reset`: this version of Next renamed it — see
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md.
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="flex min-h-0 flex-1 items-center justify-center px-4 py-10">
      <div
        className="max-w-md rounded-lg border p-6 text-center"
        style={{ borderColor: 'var(--rule-strong)', background: 'var(--surface)' }}
      >
        <h1 className="font-display text-lg font-semibold" style={{ color: 'var(--ink)' }}>
          Something went wrong
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
          This page could not be worked out. Trying again sometimes helps; if it does not, starting
          a new comparison will.
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => retry()}
            className="rounded-lg border px-5 py-2.5 text-sm font-semibold"
            style={{ borderColor: 'var(--rule-strong)', color: 'var(--ink)' }}
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-block rounded-lg px-5 py-2.5 text-sm font-semibold"
            style={{ background: 'var(--accent)', color: '#ffffff' }}
          >
            Start a new comparison
          </Link>
        </div>
      </div>
    </main>
  );
}
