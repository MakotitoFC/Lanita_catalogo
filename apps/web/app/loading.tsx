/** Esqueleto de la portada: se ve al instante mientras llegan las ofertas y los productos. */
export default function Cargando() {
  return (
    <div aria-busy="true" aria-live="polite" className="animate-pulse space-y-8 sm:space-y-10">
      <section>
        <div className="h-8 w-48 rounded-xl bg-foto sm:h-10 sm:w-64" />
        <div className="mt-2 h-4 w-60 rounded-lg bg-foto" />
        <div className="mt-4 flex gap-4 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-[76%] shrink-0 rounded-3xl bg-foto p-2 sm:w-[calc(50%-0.5rem)] sm:p-3 lg:w-[calc(33.333%-0.667rem)]">
              <div className="aspect-square rounded-2xl bg-white/70" />
              <div className="mt-3 space-y-2 px-2 pb-2">
                <div className="h-4 w-2/3 rounded bg-white/70" />
                <div className="h-3 w-5/6 rounded bg-white/70" />
                <div className="h-11 w-36 rounded-full bg-white/70" />
              </div>
            </div>
          ))}
        </div>
      </section>
      <section>
        <div className="flex items-center justify-between gap-3">
          <div className="h-8 w-52 rounded-xl bg-foto sm:h-10 sm:w-72" />
          <div className="h-11 w-44 rounded-full bg-foto" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-3xl bg-foto p-2 sm:p-3">
              <div className="aspect-square rounded-2xl bg-white/70" />
              <div className="mt-3 space-y-2 px-2 pb-2">
                <div className="h-3 w-1/3 rounded bg-white/70" />
                <div className="h-4 w-4/5 rounded bg-white/70" />
                <div className="h-4 w-1/4 rounded bg-white/70" />
              </div>
            </div>
          ))}
        </div>
      </section>
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
