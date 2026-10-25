export function Play() {
  return (
    <main className="flex min-h-dvh flex-col justify-center gap-6 bg-slate-950 px-4 py-8 text-slate-100">
      <h1 className="text-center text-4xl font-bold">Join a game</h1>
      <p className="text-center text-lg text-slate-400">Enter the 4-letter code on the TV.</p>
      <button
        type="button"
        disabled
        className="min-h-14 w-full rounded-2xl bg-amber-500 px-6 text-xl font-semibold text-slate-950 opacity-50"
      >
        Join (coming soon)
      </button>
    </main>
  );
}
