import { PedidoMapa } from '../types';
import { parseSheetDate } from './ordersCore';
import type { PedidosFilters } from './clienteApi';

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
      !p.statusPgto.toUpperCase().includes(filters.statusPgto.toUpperCase())
    )
      return false;
    if (!matchesDateRange(p.data, filters.dateFrom, filters.dateTo)) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const hit =
        p.nomeCliente.toLowerCase().includes(q) ||
        p.cnpj.includes(q) ||
        p.numNF.includes(q) ||
        p.numPedidoCli.includes(q) ||
        p.numPedidoDist.includes(q) ||
        p.descricaoProduto.toLowerCase().includes(q);
      if (!hit) return false;
    }
    return true;
  });
}

/** Resumo de vencimentos para exibição no card do cliente. */
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
  const parts = [p.parc1, p.parc2, p.parc3, p.parc4].map((d) => d?.trim()).filter(Boolean);
  if (!parts.length) return null;
  if (parts.length === 1) return `Vencimento: ${parts[0]}`;
  return `Vencimentos: ${parts.join(' · ')}`;
}
