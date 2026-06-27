import { PedidoMapa } from '../types';

const TZ = 'America/Sao_Paulo';

/** Data de revisão no fuso de São Paulo (dd/MM/yyyy). */
export function todayReviewDateBR(): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date());
}

/** Chave estável do pedido para revisão diária. */
export function buildPedidoReviewKey(
  p: Pick<PedidoMapa, 'rowNum' | 'mapaKind' | 'mapaSpreadsheetId' | 'mapaYear'>
): string {
  const kind = p.mapaKind ?? 'pedido';
  const sheet = p.mapaSpreadsheetId ?? `year-${p.mapaYear ?? 0}`;
  return `${sheet}_${kind}_${p.rowNum}`;
}

/** Pedidos que entram na fila: col Q com PENDENTE ou RMA, ou col AB com RMA. */
export function needsDailyReview(p: PedidoMapa): boolean {
  const q = String(p.status ?? '').toUpperCase();
  const ab = String(p.obsCliente ?? '').toUpperCase();
  return q.includes('PENDENTE') || q.includes('RMA') || ab.includes('RMA');
}

export function filterDailyReviewQueue(pedidos: PedidoMapa[]): PedidoMapa[] {
  return pedidos.filter(needsDailyReview);
}

export type DailyReviewTipoFilter = '' | 'PENDENTE' | 'RMA';

export function hasPendingTag(p: PedidoMapa): boolean {
  return String(p.status ?? '').toUpperCase().includes('PENDENTE');
}

export function hasRmaTag(p: PedidoMapa): boolean {
  const q = String(p.status ?? '').toUpperCase();
  const ab = String(p.obsCliente ?? '').toUpperCase();
  return q.includes('RMA') || ab.includes('RMA');
}

export function matchesDailyReviewTipo(p: PedidoMapa, tipo: DailyReviewTipoFilter): boolean {
  if (!tipo) return true;
  if (tipo === 'PENDENTE') return hasPendingTag(p);
  return hasRmaTag(p);
}

export interface DailyReviewListFilters {
  search?: string;
  distribuidor?: string;
  tipo?: DailyReviewTipoFilter;
}

export function filterDailyReviewList(
  pedidos: PedidoMapa[],
  filters: DailyReviewListFilters,
  searchFn: (p: PedidoMapa, query: string) => boolean
): PedidoMapa[] {
  return pedidos.filter((p) => {
    if (filters.distribuidor && p.distribuidor !== filters.distribuidor) return false;
    if (!matchesDailyReviewTipo(p, filters.tipo ?? '')) return false;
    if (filters.search?.trim() && !searchFn(p, filters.search)) return false;
    return true;
  });
}

export function reviewDocId(reviewDate: string, pedidoKey: string): string {
  const safeDate = reviewDate.replace(/\//g, '-');
  const safeKey = pedidoKey.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${safeDate}__${safeKey}`;
}
