/** Vencimentos L–O: data + marcador `| PAGA` por parcela. */

export interface ParsedParcel {
  dateBR: string;
  paid: boolean;
  raw: string;
}

export function parseParcelValue(raw: string): ParsedParcel {
  const rawTrim = String(raw ?? '').trim();
  if (!rawTrim) return { dateBR: '', paid: false, raw: '' };

  const paid =
    /\|\s*PAGA\b/i.test(rawTrim) ||
    /\bPAGA\s*$/i.test(rawTrim) ||
    rawTrim.toUpperCase() === 'PAGA';

  let cleaned = rawTrim
    .replace(/\s*\|\s*PAGA\s*/gi, ' ')
    .replace(/\bPAGA\s*$/gi, '')
    .trim();

  const dateMatch = cleaned.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
  const dateBR = dateMatch ? dateMatch[1] : cleaned;

  return { dateBR, paid, raw: rawTrim };
}

export function formatParcelValue(dateBR: string, paid: boolean): string {
  const d = dateBR.trim();
  if (!d) return paid ? 'PAGA' : '';
  return paid ? `${d} | PAGA` : d;
}

export function deriveStatusPgtoFromParcels(
  parc1: string,
  parc2: string,
  parc3: string,
  parc4: string
): string {
  const cells = [parc1, parc2, parc3, parc4].map(parseParcelValue);
  const relevant = cells.filter((c) => c.dateBR || c.paid);
  if (!relevant.length) return 'SEM DATA';
  if (relevant.every((c) => c.paid)) return 'PAGA';
  if (relevant.some((c) => c.paid)) return 'A VENCER';
  return 'A VENCER';
}

/** Texto amigável no card (data + indicador pago). */
export function formatParcelDisplay(raw: string): string {
  const { dateBR, paid } = parseParcelValue(raw);
  if (!dateBR && !paid) return '';
  if (!dateBR) return 'Paga';
  return paid ? `${dateBR} (paga)` : dateBR;
}
