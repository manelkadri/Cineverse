// Lightweight route skeleton shown by the App Router while a page streams in. It deliberately replaces the
// cinematic CINEVERSE loader, which now plays only after a profile is selected (see CinematicTransitionProvider).
export default function Loading() {
  return (
    <main className="min-h-screen animate-pulse bg-background" aria-busy="true" data-route-skeleton>
      <div className="h-[66px] bg-black/80" />
      <div className="h-[70vh] bg-gradient-to-r from-[#08090b] via-[#12151a] to-[#08090b]" />
      <div className="space-y-8 px-4 py-8 lg:px-10">
        {[1, 2, 3].map((row) => <div key={row}><div className="mb-4 h-5 w-48 rounded bg-white/10" /><div className="flex gap-3">{[1, 2, 3, 4, 5, 6].map((card) => <div key={card} className="aspect-[2/3] w-36 rounded-lg bg-white/[0.06]" />)}</div></div>)}
      </div>
    </main>
  );
}
