/** Parse valor monetário BR ou número (igual portal comercial). */
export function parseBRLnum(v: string | number): number {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number' && !isNaN(v)) return v;

  const s = String(v).trim().replace(/R\$\s?/gi, '').trim();
  if (!s) return 0;

  if (s.includes(',')) {
    const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }

  const n = parseFloat(s.replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

/** Formato gravado no Mapa: R$ 629,00 */
export function formatBRLForSheet(n: number): string {
  if (!n && n !== 0) return '';
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Formato gravado no Mapa: 38,55% */
export function formatPctForSheet(n: number): string {
  if (!isFinite(n)) return '';
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export function formatBRLDisplay(v: string | number): string {
  const n = parseBRLnum(v);
  if (!n) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
