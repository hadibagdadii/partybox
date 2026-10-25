import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@partybox/shared';
import { useSearchParams } from 'react-router-dom';

const notInAlphabet = new RegExp(`[^${ROOM_CODE_ALPHABET}]`, 'g');
const MAX_PHONES = 12;

/** Dev-only: N phone views side by side, each with its own token slot. */
export function Dev() {
  const [params, setParams] = useSearchParams();
  const code = (params.get('code') ?? '')
    .toUpperCase()
    .replace(notInAlphabet, '')
    .slice(0, ROOM_CODE_LENGTH);
  const n = Math.min(MAX_PHONES, Math.max(1, Number(params.get('n')) || 7));

  const update = (next: { code?: string; n?: number }) => {
    setParams({ code: next.code ?? code, n: String(next.n ?? n) }, { replace: true });
  };

  return (
    <main className="min-h-dvh bg-slate-900 p-4 text-slate-100">
      <header className="mb-4 flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-bold">Dev phones</h1>
        <label className="flex items-center gap-2">
          Code
          <input
            value={code}
            onChange={(e) => update({ code: e.target.value })}
            className="w-24 rounded bg-slate-800 px-2 py-1 uppercase tracking-widest"
          />
        </label>
        <label className="flex items-center gap-2">
          Phones
          <input
            type="number"
            min={1}
            max={MAX_PHONES}
            value={n}
            onChange={(e) => update({ n: Number(e.target.value) })}
            className="w-16 rounded bg-slate-800 px-2 py-1"
          />
        </label>
        <a href="/host" target="_blank" rel="noreferrer" className="text-amber-400 underline">
          Open host
        </a>
      </header>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
        {Array.from({ length: n }, (_, i) => i + 1).map((slot) => (
          <div key={slot} className="flex flex-col gap-1">
            <span className="text-sm text-slate-400">Slot {slot}</span>
            <iframe
              title={`Phone ${slot}`}
              src={`/play?slot=${slot}${code ? `&code=${code}` : ''}`}
              className="h-[600px] w-full rounded-xl border border-slate-700"
            />
          </div>
        ))}
      </div>
    </main>
  );
}
