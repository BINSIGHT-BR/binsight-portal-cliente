/** Valores típicos da coluna AB (obsCliente) — mensagens visíveis ao cliente. */
export const OBS_CLIENTE_STATUSES = [
  'Pendente de NF',
  'Pendente de NF e Boleto',
  'RMA',
  'Pendente de pagamento',
  'Cancelado',
  'Faturado',
  'Em processo de entrega',
  'Entregue',
  'Licença disponibilizada',
  'Aguardando confirmação',
  'Em análise de crédito',
] as const;

export type ObsClienteStatus = (typeof OBS_CLIENTE_STATUSES)[number];

export function isObsClientePendingNf(obs: string): boolean {
  const o = obs.trim().toLowerCase();
  return o.includes('pendente de nf') && !o.includes('boleto');
}
