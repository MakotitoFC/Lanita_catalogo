export default function Cargando() {
  return (
    <div aria-busy="true" aria-live="polite" className="animate-pulse">
      <div className="mb-4 h-11 w-28 rounded-2xl bg-foto" />
      <div className="grid gap-6 md:grid-cols-2 md:gap-10">
        <div className="aspect-[4/5] w-full rounded-2xl bg-foto" />
        <div className="space-y-4">
          <div className="h-10 w-3/4 rounded-2xl bg-foto" />
          <div className="h-12 w-32 rounded-2xl bg-foto" />
          <div className="h-4 w-full rounded-2xl bg-foto" />
          <div className="h-4 w-5/6 rounded-2xl bg-foto" />
          <div className="mt-6 h-11 w-full max-w-sm rounded-2xl bg-foto" />
        </div>
      </div>
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
