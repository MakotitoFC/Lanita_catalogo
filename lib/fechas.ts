const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// "2026-11-20" -> { d: 20, m: "noviembre" } (sin convertir zonas horarias)
const partes = (iso: string) => {
  const [, m, d] = iso.split('-').map(Number);
  return { d: d ?? 1, m: MESES[(m ?? 1) - 1] ?? '' };
};

/** "Del 10 al 20 de noviembre" / "Del 28 de noviembre al 5 de diciembre" */
export function vigencia(inicio: string, fin: string) {
  const a = partes(inicio), b = partes(fin);
  return a.m === b.m ? `Del ${a.d} al ${b.d} de ${b.m}` : `Del ${a.d} de ${a.m} al ${b.d} de ${b.m}`;
}

/** "Válida hasta el 17 de octubre" */
export function hasta(fin: string) {
  const b = partes(fin);
  return `Válida hasta el ${b.d} de ${b.m}`;
}
