import { PedidoMapa } from './constants';

const NF_PENDING_DAYS = 3;

export interface ServerAlert {
  kind: 'pagamento_vencido' | 'pagamento_a_vencer' | 'nf_pendente';
  rowNum: number;
  nomeCliente: string;
  numPedidoCli: string;
  numNF: string;
  message: string;
  severity: 'warning' | 'critical';
}

function emissaoIsNao(val: string): boolean {
  const v = val.trim().toLowerCase();
  return v === 'não' || v === 'nao' || v === '✖' || v === 'n' || v === 'no';
}

function parseSheetDate(val: string): Date | null {
  if (!val) return null;
  const br = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return new Date(+br[3], +br[2] - 1, +br[1]);
  return null;
}

function daysSince(date: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - d.getTime()) / 86400000);
}

export function computeAlerts(pedidos: PedidoMapa[]): ServerAlert[] {
  const alerts: ServerAlert[] = [];

  for (const p of pedidos) {
    const pgto = p.statusPgto.toUpperCase();
    const ref = p.numPedidoCli || p.numNF || 'sem ref';

    if (pgto.includes('VENCID')) {
      alerts.push({
        kind: 'pagamento_vencido',
        rowNum: p.rowNum,
        nomeCliente: p.nomeCliente,
        numPedidoCli: p.numPedidoCli,
        numNF: p.numNF,
        message: `${p.nomeCliente} — parcela vencida (${ref})`,
        severity: 'critical',
      });
    } else if (pgto.includes('A VENC') || pgto.includes('VENCER')) {
      alerts.push({
        kind: 'pagamento_a_vencer',
        rowNum: p.rowNum,
        nomeCliente: p.nomeCliente,
        numPedidoCli: p.numPedidoCli,
        numNF: p.numNF,
        message: `${p.nomeCliente} — pagamento a vencer em breve`,
        severity: 'warning',
      });
    }

    const orderDate = parseSheetDate(p.data);
    if (orderDate && emissaoIsNao(p.emissao) && daysSince(orderDate) >= NF_PENDING_DAYS) {
      alerts.push({
        kind: 'nf_pendente',
        rowNum: p.rowNum,
        nomeCliente: p.nomeCliente,
        numPedidoCli: p.numPedidoCli,
        numNF: p.numNF,
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
