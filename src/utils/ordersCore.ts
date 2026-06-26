import { CONSOLIDADO_COL_COUNT } from '../constants/columns';
import { PedidoMapa } from '../types';

export function normalizeCNPJ(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function formatCNPJ(digits: string): string {
  const d = normalizeCNPJ(digits);
  if (d.length !== 14) return digits;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function normalizeStatusPgto(val: string): string {
  const s = (val ?? '').trim().toUpperCase();
  if (!s) return 'SEM DATA';
  if (s.includes('SEM DATA') || s === '—' || s === '-') return 'SEM DATA';
  if (s.includes('VENCID')) return 'VENCIDA';
  if (s.includes('A VENC') || s.includes('VENCER')) return 'A VENCER';
  if (s.includes('PAGA') || s === 'PAGO') return 'PAGA';
  return s;
}

/** Infere status pagamento a partir de datas de vencimento preenchidas. */
export function deriveStatusPgtoFromDates(dates: string[]): string {
  const filled = dates.map((d) => d.trim()).filter(Boolean);
  return filled.length ? 'A VENCER' : 'SEM DATA';
}

/** Linha A–AB para CONSOLIDADO e abas mensais. */
export function pedidoToMapaRow(p: PedidoMapa): string[] {
  const row = [
    p.data,
    p.vendedor,
    p.cnpj,
    p.nomeCliente,
    p.numPedidoCli,
    p.prioridade,
    p.descricaoProduto,
    p.distribuidor,
    p.numPedidoDist,
    p.emissao,
    p.numNF,
    p.parc1,
    p.parc2,
    p.parc3,
    p.parc4,
    p.statusPgto,
    p.status,
    p.qtd,
    p.custoDist,
    p.totalCompra,
    p.vendBins,
    p.vendaTotal,
    p.vendaPct,
    p.bruto,
    p.liquido,
    p.statusComissao,
    p.obsPedido,
    p.obsCliente,
    p.nfDriveUrl ?? '',
    p.boletoDriveUrl ?? '',
  ];
  while (row.length < CONSOLIDADO_COL_COUNT) row.push('');
  return row.slice(0, CONSOLIDADO_COL_COUNT);
}

export function filterOrdersByCnpjs(pedidos: PedidoMapa[], cnpjs: string[]): PedidoMapa[] {
  const set = new Set(cnpjs.map(normalizeCNPJ));
  if (set.size === 0) return [];
  return pedidos.filter((p) => set.has(normalizeCNPJ(p.cnpj)));
}

export function parseSheetDate(val: string): Date | null {
  if (!val) return null;
  const s = String(val).trim();
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return new Date(+br[3], +br[2] - 1, +br[1]);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.substring(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return null;
}

export function fmtBRL(v: string): string {
  const n = parseFloat(v.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, ''));
  if (isNaN(n)) return v || '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function isoDateToBR(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
}

export function brDateToIso(br: string): string {
  const m = br.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return '';
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}
