/** Regras de status visíveis ao cliente (cols Q e Z do CONSOLIDADO). */

import { parseSheetDate } from './ordersCore';

/** Após N dias com col Q = FATURADO → considerar entregue (sem precisar col Z PAGA). */
export const ENTREGUE_APOS_FATURADO_DIAS = 20;

export interface ClientOrderStatusInput {
  status: string;
  statusComissao?: string;
  obsCliente?: string;
  emissao?: string;
  /** Col A — data do pedido / referência de faturamento. */
  data?: string;
}

function daysSinceDate(d: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - t.getTime()) / 86400000);
}

function statusIsFaturado(status: string): boolean {
  return status.trim().toUpperCase().includes('FATURADO');
}

/** Col Q = FATURADO há mais de 20 dias → entregue ao cliente. */
export function isFaturadoEntreguePorPrazo(input: ClientOrderStatusInput): boolean {
  if (!statusIsFaturado(input.status ?? '')) return false;
  const d = parseSheetDate(input.data ?? '');
  if (!d) return false;
  return daysSinceDate(d) > ENTREGUE_APOS_FATURADO_DIAS;
}

/** Col Z (status comissão) = PAGA — case-insensitive. */
export function isComissaoPaga(statusComissao?: string): boolean {
  const z = (statusComissao ?? '').trim().toUpperCase();
  return z === 'PAGA' || z.includes('PAGA');
}

/** Pedido entregue: col Z PAGA, Q FATURADO + 20 dias, ou Q ENTREGUE/FINALIZADO. */
export function isPedidoEntregue(input: ClientOrderStatusInput): boolean {
  if (isComissaoPaga(input.statusComissao)) return true;
  if (isFaturadoEntreguePorPrazo(input)) return true;
  const q = (input.status ?? '').trim().toUpperCase();
  return q.includes('ENTREGUE') || q.includes('FINALIZADO');
}

/** Pagamento vencido (col P) — exceto quando col Z já está PAGA. */
export function isPagamentoVencido(input: { statusPgto: string; statusComissao?: string }): boolean {
  if (isComissaoPaga(input.statusComissao)) return false;
  return input.statusPgto.toUpperCase().includes('VENCID');
}

/** Col Q = FATURADO → um único rótulo combinado; entregue por Z PAGA ou +20 dias. */
export function resolveClientOrderLabel(input: ClientOrderStatusInput): string {
  if (isPedidoEntregue(input)) return 'Entregue';

  const q = (input.status ?? '').trim().toUpperCase();
  if (q.includes('FATURADO')) return 'Faturado · Em processo de entrega';

  if (q.includes('CANCELADO')) return 'Cancelado';

  const obs = (input.obsCliente ?? '').trim();
  if (obs) return obs;

  return (input.status ?? '').trim() || 'Pendente';
}

export function clientStatusForFilter(input: ClientOrderStatusInput): string {
  return resolveClientOrderLabel(input);
}
