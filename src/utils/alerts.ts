import { OrderAlert, PedidoMapa } from '../types';
import { parseSheetDate } from './orders';

const NF_PENDING_DAYS = 3;

function emissaoIsNao(val: string): boolean {
  const v = val.trim().toLowerCase();
  return v === 'não' || v === 'nao' || v === '✖' || v === 'n' || v === 'no';
}

function daysSince(date: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - d.getTime()) / (86400000));
}

/** Alertas para visão financeiro/admin — pagamento (cols L–O via statusPgto) e NF pendente. */
export function computeOrderAlerts(pedidos: PedidoMapa[]): OrderAlert[] {
  const alerts: OrderAlert[] = [];

  for (const p of pedidos) {
    const pgto = p.statusPgto.toUpperCase();

    if (pgto.includes('VENCID')) {
      alerts.push({
        kind: 'pagamento_vencido',
        pedido: p,
        message: `${p.nomeCliente} — parcela vencida (${p.numPedidoCli || p.numNF || 'sem ref'})`,
        severity: 'critical',
      });
    } else if (pgto.includes('A VENC') || pgto.includes('VENCER')) {
      alerts.push({
        kind: 'pagamento_a_vencer',
        pedido: p,
        message: `${p.nomeCliente} — pagamento a vencer em breve`,
        severity: 'warning',
      });
    }

    const orderDate = parseSheetDate(p.data);
    if (orderDate && emissaoIsNao(p.emissao) && daysSince(orderDate) >= NF_PENDING_DAYS) {
      alerts.push({
        kind: 'nf_pendente',
        pedido: p,
        message: `${p.nomeCliente} — NF pendente há ${daysSince(orderDate)} dias (col J = Não)`,
        severity: 'warning',
      });
    }
  }

  return alerts.sort((a, b) => {
    if (a.severity === b.severity) return 0;
    return a.severity === 'critical' ? -1 : 1;
  });
}

export function countAlertsByKind(alerts: OrderAlert[]) {
  return {
    pagamento_vencido: alerts.filter((a) => a.kind === 'pagamento_vencido').length,
    pagamento_a_vencer: alerts.filter((a) => a.kind === 'pagamento_a_vencer').length,
    nf_pendente: alerts.filter((a) => a.kind === 'nf_pendente').length,
    total: alerts.length,
  };
}
