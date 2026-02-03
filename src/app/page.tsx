'use client';

import { useState } from 'react';

interface SyncResult {
  success: boolean;
  added?: number;
  updated?: number;
  deleted?: number;
  errors?: Array<{ eventId: string; error: string }>;
  error?: string;
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const handleSync = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/sync', { method: 'POST' });
      const data = await response.json();
      setResult(data);
      if (data.success) {
        setLastSync(new Date());
      }
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-black">
      <main className="mx-auto max-w-2xl px-6 py-16">
        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-3">
            <span className="text-4xl">📅</span>
            <span className="text-2xl text-zinc-400">→</span>
            <span className="text-4xl">📝</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            GCal → Notion Sync
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Synchronize your Google Calendar events to Notion database
          </p>
        </div>

        <div className="mb-8 flex justify-center">
          <button
            onClick={handleSync}
            disabled={isLoading}
            className="group relative inline-flex h-14 items-center justify-center gap-3 rounded-full bg-zinc-900 px-8 text-lg font-medium text-white transition-all hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {isLoading ? (
              <>
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Syncing...
              </>
            ) : (
              <>
                <svg className="h-5 w-5 transition-transform group-hover:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Now
              </>
            )}
          </button>
        </div>

        {lastSync && (
          <p className="mb-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Last synced: {lastSync.toLocaleTimeString()}
          </p>
        )}

        {result && (
          <div className={`rounded-2xl border p-6 ${
            result.success
              ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950'
              : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950'
          }`}>
            <div className="mb-4 flex items-center gap-2">
              {result.success ? (
                <>
                  <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-semibold text-green-800 dark:text-green-200">Sync Completed</span>
                </>
              ) : (
                <>
                  <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-semibold text-red-800 dark:text-red-200">Sync Failed</span>
                </>
              )}
            </div>

            {result.success ? (
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="rounded-xl bg-white/60 p-4 dark:bg-zinc-900/40">
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400">{result.added}</div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">Added</div>
                </div>
                <div className="rounded-xl bg-white/60 p-4 dark:bg-zinc-900/40">
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{result.updated}</div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">Updated</div>
                </div>
                <div className="rounded-xl bg-white/60 p-4 dark:bg-zinc-900/40">
                  <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">{result.deleted}</div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">Deleted</div>
                </div>
              </div>
            ) : (
              <p className="text-red-700 dark:text-red-300">{result.error}</p>
            )}

            {result.errors && result.errors.length > 0 && (
              <div className="mt-4 rounded-lg bg-white/40 p-4 dark:bg-zinc-900/40">
                <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {result.errors.length} error(s) occurred:
                </p>
                <ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {result.errors.map((err, i) => (
                    <li key={i} className="font-mono">
                      {err.eventId}: {err.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            How it works
          </h2>
          <ul className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-green-500">✓</span>
              <span>Fetches events from all shared Google Calendars (past 30 days to next 90 days)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-green-500">✓</span>
              <span>Creates new pages in Notion for new events</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-green-500">✓</span>
              <span>Updates existing pages when events change</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-green-500">✓</span>
              <span>Archives pages for deleted calendar events</span>
            </li>
          </ul>
        </div>

        <footer className="mt-12 text-center text-sm text-zinc-400">
          <p>Powered by Next.js • Deployed on Vercel</p>
        </footer>
      </main>
    </div>
  );
}
