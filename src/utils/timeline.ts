import { getTimelineStages } from '../constants/timeline';
import { isPedidoEntregue } from './clientOrderStatus';
import { PedidoCliente, PedidoMapa, TimelineStageId, TipoProdutoPedido } from '../types';

function emissaoIsSim(val: string): boolean {
  const v = val.trim().toLowerCase();
  return v === 'sim' || v === '✔' || v === 's' || v === 'yes';
}

function statusIncludes(status: string, ...needles: string[]): boolean {
  const s = status.toUpperCase();
  return needles.some((n) => s.includes(n));
}

/** Determina estágio atual e estágios concluídos para a timeline. */
export function resolveTimelineProgress(
  pedido: PedidoMapa | PedidoCliente,
  tipo: TipoProdutoPedido
): { current: TimelineStageId; completed: TimelineStageId[] } {
  const status = pedido.status ?? '';
  const obs = ('obsCliente' in pedido ? pedido.obsCliente : '') ?? '';
  const emissao = pedido.emissao ?? '';
  const statusComissao =
    'statusComissao' in pedido ? String(pedido.statusComissao ?? '') : '';
  const obsLower = obs.toLowerCase();
  const entregue = isPedidoEntregue({
    status,
    statusComissao,
    obsCliente: obs,
    emissao,
    data: pedido.data,
  });

  const completed: TimelineStageId[] = ['confirmado'];

  if (statusIncludes(status, 'PENDENTE') && !statusIncludes(status, 'FATURADO')) {
    if (obsLower.includes('crédito') || obsLower.includes('credito')) {
      completed.push('credito');
      return { current: 'credito', completed };
    }
    return { current: 'confirmado', completed };
  }

  completed.push('credito');

  if (obsLower.includes('cancelado') || statusIncludes(status, 'CANCELADO')) {
    return { current: 'credito', completed };
  }

  if (emissaoIsSim(emissao) || statusIncludes(status, 'FATURADO', 'FINALIZADO')) {
    completed.push('faturado');
  } else {
    return { current: 'credito', completed };
  }

  // Col Z PAGA ou status entregue → concluído
  if (entregue) {
    if (tipo === 'software') {
      completed.push('licenca');
      return { current: 'licenca', completed };
    }
    completed.push('rota', 'entregue');
    return { current: 'entregue', completed };
  }

  // Col Q FATURADO (sem Z PAGA) → faturado + em processo de entrega
  if (statusIncludes(status, 'FATURADO')) {
    if (tipo === 'software') {
      return { current: 'faturado', completed };
    }
    completed.push('rota');
    return { current: 'rota', completed };
  }

  if (tipo === 'software') {
    if (
      obsLower.includes('licença') ||
      obsLower.includes('licenca') ||
      statusIncludes(status, 'FINALIZADO', 'ENTREGUE')
    ) {
      completed.push('licenca');
      return { current: 'licenca', completed };
    }
    return { current: 'faturado', completed };
  }

  if (
    obsLower.includes('processo de entrega') ||
    obsLower.includes('rota') ||
    statusIncludes(status, 'TRANSITO', 'ROTA')
  ) {
    completed.push('rota');
    if (statusIncludes(status, 'ENTREGUE') || obsLower.includes('entregue')) {
      completed.push('entregue');
      return { current: 'entregue', completed };
    }
    return { current: 'rota', completed };
  }

  if (statusIncludes(status, 'ENTREGUE') || obsLower.includes('entregue')) {
    completed.push('rota', 'entregue');
    return { current: 'entregue', completed };
  }

  return { current: 'faturado', completed };
}

export function getStagesForPedido(pedido: PedidoMapa | PedidoCliente) {
  const tipo: TipoProdutoPedido =
    ('mapaKind' in pedido && pedido.mapaKind === 'assinatura') ||
    ('tipoProduto' in pedido && pedido.tipoProduto === 'software')
      ? 'software'
      : 'tipoProduto' in pedido && pedido.tipoProduto
        ? pedido.tipoProduto
        : inferTipoFromDesc('descricaoProduto' in pedido ? pedido.descricaoProduto : '');
  const stages = getTimelineStages(tipo);
  const progress = resolveTimelineProgress(pedido, tipo);
  return { stages, ...progress, tipo };
}

function inferTipoFromDesc(desc: string): TipoProdutoPedido {
  const d = desc.toLowerCase();
  return ['licença', 'licenca', 'software', 'saas'].some((k) => d.includes(k))
    ? 'software'
    : 'hardware';
}
