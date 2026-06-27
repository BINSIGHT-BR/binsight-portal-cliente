import { PedidoMapa } from '../types';
import { parseSheetDate } from './ordersCore';
import { clientStatusForFilter, isComissaoPaga } from './clientOrderStatus';
import { formatParcelDisplay } from './parcelPayment';
import type { PedidosFilters } from './clienteApi';

/** Normaliza texto para busca (ignora espaços, hífens, pontuação comum em BIN/CNPJ). */
export function normalizeSearchText(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-./_]/g, '');
}

/** Variantes da busca — ex.: BIN2606091152 encontra 2606091152 na col E. */
export function searchQueryVariants(query: string): string[] {
  const q = normalizeSearchText(query);
  if (!q) return [];
  const variants = new Set<string>([q]);
  if (q.startsWith('bin')) variants.add(q.slice(3));
  return [...variants].filter(Boolean);
}

/** Rótulo do nº pedido no card (BIN na col E ou I). */
export function pedidoRefBadge(p: {
  numPedidoCli?: string;
  numPedidoDist?: string;
}): { kind: 'BIN' | 'OC'; value: string } | null {
  const dist = String(p.numPedidoDist ?? '').trim();
  const cli = String(p.numPedidoCli ?? '').trim();
  if (dist) return { kind: 'BIN', value: dist };
  if (cli) return { kind: /^bin/i.test(cli) ? 'BIN' : 'OC', value: cli };
  return null;
}

const SEARCH_FIELDS = (p: PedidoMapa) => [
  p.nomeCliente,
  p.cnpj,
  p.numNF,
  p.numPedidoCli,
  p.numPedidoDist,
  p.numContratoDist,
  p.descricaoProduto,
  p.distribuidor,
  p.vendedor,
  p.obsCliente,
  p.obsPedido,
  p.data,
  p.parc1,
  p.parc2,
  p.parc3,
  p.parc4,
  p.status,
  p.statusPgto,
  p.statusComissao,
];

/** Campos pesquisáveis (col E = numPedidoCli, col I = numPedidoDist). */
export function pedidoMatchesSearch(p: PedidoMapa, query: string): boolean {
  const variants = searchQueryVariants(query);
  if (!variants.length) return true;
  const blob = normalizeSearchText(SEARCH_FIELDS(p).join(' '));
  if (variants.some((v) => blob.includes(v))) return true;
  // Match direto em refs de pedido (col E / I)
  const refs = normalizeSearchText([p.numPedidoCli, p.numPedidoDist, p.numContratoDist].join(' '));
  return variants.some((v) => refs.includes(v));
}

function matchesStatusPgtoFilter(statusPgto: string, statusComissao: string | undefined, filter: string): boolean {
  const pg = filter.toUpperCase();
  if (pg.includes('VENCID') && isComissaoPaga(statusComissao)) return false;
  return statusPgto.toUpperCase().includes(pg);
}

function matchesDateRange(dataBR: string, dateFrom?: string, dateTo?: string): boolean {
  if (!dateFrom && !dateTo) return true;
  const d = parseSheetDate(dataBR);
  if (!d) return false;
  if (dateFrom) {
    const from = new Date(`${dateFrom}T00:00:00`);
    if (d < from) return false;
  }
  if (dateTo) {
    const to = new Date(`${dateTo}T23:59:59`);
    if (d > to) return false;
  }
  return true;
}

export function filterPedidos(pedidos: PedidoMapa[], filters?: PedidosFilters): PedidoMapa[] {
  if (!filters) return pedidos;
  return pedidos.filter((p) => {
    if (filters.status && !p.status.toUpperCase().includes(filters.status.toUpperCase())) return false;
    if (
      filters.distribuidor &&
      !p.distribuidor.toLowerCase().includes(filters.distribuidor.toLowerCase())
    )
      return false;
    if (
      filters.statusPgto &&
      !matchesStatusPgtoFilter(p.statusPgto, p.statusComissao, filters.statusPgto)
    )
      return false;
    if (!matchesDateRange(p.data, filters.dateFrom, filters.dateTo)) return false;
    if (filters.search && !pedidoMatchesSearch(p, filters.search)) return false;
    return true;
  });
}

/** Filtros para visão cliente (status derivado de cols Q e Z). */
export function filterPedidosForClient(pedidos: PedidoMapa[], filters?: PedidosFilters): PedidoMapa[] {
  if (!filters) return pedidos;
  return pedidos.filter((p) => {
    const statusLabel = clientStatusForFilter(p);
    if (filters.status && !statusLabel.toUpperCase().includes(filters.status.toUpperCase())) return false;
    if (
      filters.distribuidor &&
      !p.distribuidor.toLowerCase().includes(filters.distribuidor.toLowerCase())
    )
      return false;
    if (
      filters.statusPgto &&
      !matchesStatusPgtoFilter(p.statusPgto, p.statusComissao, filters.statusPgto)
    )
      return false;
    if (!matchesDateRange(p.data, filters.dateFrom, filters.dateTo)) return false;
    if (filters.search && !pedidoMatchesSearch(p, filters.search)) return false;
    return true;
  });
}

export function formatVencimentosResumo(p: {
  mapaKind?: string;
  vencimento?: string;
  parc1?: string;
  parc2?: string;
  parc3?: string;
  parc4?: string;
}): string | null {
  if (p.mapaKind === 'assinatura') {
    const v = (p.vencimento ?? p.parc1 ?? '').trim();
    return v ? `Vencimento: ${v}` : null;
  }
  const parts = [p.parc1, p.parc2, p.parc3, p.parc4]
    .map((d) => formatParcelDisplay(d ?? ''))
    .filter(Boolean);
  if (!parts.length) return null;
  if (parts.length === 1) return `Vencimento: ${parts[0]}`;
  return `Vencimentos: ${parts.join(' · ')}`;
}
