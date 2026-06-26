import { TimelineStage, TipoProdutoPedido } from '../types';

/** Fluxo hardware — entrega física. */
export const TIMELINE_HARDWARE: TimelineStage[] = [
  { id: 'confirmado', label: 'Pedido Confirmado', description: 'Pedido registrado no sistema' },
  { id: 'credito', label: 'Análise de Crédito', description: 'Validação financeira' },
  { id: 'faturado', label: 'Pedido Faturado', description: 'NF emitida' },
  { id: 'rota', label: 'Em processo de entrega', description: 'Despachado ou aguardando retirada' },
  { id: 'entregue', label: 'Entregue', description: 'Recebido pelo cliente' },
];

/** Fluxo software — licenciamento digital. */
export const TIMELINE_SOFTWARE: TimelineStage[] = [
  { id: 'confirmado', label: 'Pedido Confirmado', description: 'Pedido registrado no sistema' },
  { id: 'credito', label: 'Análise de Crédito', description: 'Validação financeira' },
  { id: 'faturado', label: 'Pedido Faturado', description: 'NF emitida' },
  { id: 'licenca', label: 'Licença disponibilizada', description: 'Chaves ou acesso liberado' },
];

export function getTimelineStages(tipo: TipoProdutoPedido): TimelineStage[] {
  return tipo === 'software' ? TIMELINE_SOFTWARE : TIMELINE_HARDWARE;
}
