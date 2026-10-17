/**
 * Convierte lo que escribe la persona en un número decimal.
 * Acepta punto o coma como separador ("12.50" o "12,50") y devuelve NaN si no es un número.
 *
 * Los campos numéricos no sirven para esto en el celular: con coma, el navegador
 * devuelve un valor vacío y el monto se guardaba en cero.
 */
export function parseDecimal(texto: string): number {
  const limpio = texto.trim().replace(/\s/g, '');
  if (!limpio) return NaN;

  const ultimaComa = limpio.lastIndexOf(',');
  const ultimoPunto = limpio.lastIndexOf('.');
  let normal = limpio;
  if (ultimaComa !== -1 && ultimoPunto !== -1) {
    // Si aparecen los dos, el último es el decimal y el otro separa miles.
    normal = ultimaComa > ultimoPunto
      ? limpio.replace(/\./g, '').replace(',', '.')
      : limpio.replace(/,/g, '');
  } else if (ultimaComa !== -1) {
    normal = limpio.replace(',', '.');
  }

  return /^(\d+(\.\d*)?|\.\d+)$/.test(normal) ? Number(normal) : NaN;
}
