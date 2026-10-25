import { Link } from 'react-router-dom';

export function Landing() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-slate-950 p-6 text-slate-100">
      <h1 className="text-5xl font-bold tracking-tight">Partybox</h1>
      <div className="flex w-full max-w-sm flex-col gap-4">
        <Link
          to="/play"
          className="rounded-2xl bg-amber-500 px-6 py-5 text-center text-xl font-semibold text-slate-950"
        >
          Join a game
        </Link>
        <Link
          to="/host"
          className="rounded-2xl border border-slate-600 px-6 py-5 text-center text-xl font-semibold"
        >
          Host on this screen
        </Link>
      </div>
    </main>
  );
}
