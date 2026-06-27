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

/** Interpreta % da planilha: 38,55 | 38,55% | 0,3855 (ratio) | 0,08 (ratio 8%). */
export function parsePctNum(v: string | number): number | null {
  if (v === null || v === undefined || v === '') return null;
  const raw = String(v).trim();
  if (!raw) return null;
  const n = parseBRLnum(raw.replace(/%/g, ''));
  if (!isFinite(n)) return null;
  if (n > 0 && n < 1) return n * 100;
  return n;
}

/** Exibe margem % — recalcula de bruto/total se col W vier 0 ou vazia. */
export function formatPctDisplay(
  v: string | number,
  fallback?: { bruto?: string; totalCompra?: string; vendaTotal?: string }
): string {
  let n = parsePctNum(v);
  if ((n === null || n === 0) && fallback) {
    const bruto = parseBRLnum(fallback.bruto ?? '');
    const base =
      parseBRLnum(fallback.totalCompra ?? '') || parseBRLnum(fallback.vendaTotal ?? '');
    if (base > 0 && bruto !== 0) n = (bruto / base) * 100;
  }
  if (n === null) return '—';
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export function formatBRLDisplay(v: string | number): string {
  if (v === null || v === undefined || String(v).trim() === '') return '—';
  const n = parseBRLnum(v);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
