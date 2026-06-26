import { PedidoMapa } from '../types';
import { USE_MOCK_DATA, USE_OAUTH_SHEETS } from '../constants/columns';
import { fetchNotifyRecipientsForCnpj } from './registrySheet';
import { notifyClientePedido } from './notifyService';
import type { ClientDocKind } from './clientDrive';

function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pedidoRef(p: PedidoMapa): string {
  return p.numPedidoCli.trim() || p.numNF.trim() || `Linha ${p.rowNum}`;
}

export async function maybeNotifyPedidoChanges(
  accessToken: string,
  before: PedidoMapa,
  after: PedidoMapa
): Promise<void> {
  if (USE_MOCK_DATA || !USE_OAUTH_SHEETS) return;

  const statusChanged = (before.status ?? '').trim() !== (after.status ?? '').trim();
  const obsChanged = (before.obsCliente ?? '').trim() !== (after.obsCliente ?? '').trim();
  const pgtoChanged = (before.statusPgto ?? '').trim() !== (after.statusPgto ?? '').trim();

  if (!statusChanged && !obsChanged && !pgtoChanged) return;

  const recipients = await fetchNotifyRecipientsForCnpj(accessToken, after.cnpj);
  if (!recipients.length) return;

  const parts: string[] = [];
  if (statusChanged) parts.push(`Status do pedido: <strong>${escHtml(after.status || '—')}</strong>`);
  if (obsChanged && after.obsCliente)
    parts.push(`Atualização BInsight: <strong>${escHtml(after.obsCliente)}</strong>`);
  if (pgtoChanged) parts.push(`Pagamento: <strong>${escHtml(after.statusPgto || '—')}</strong>`);

  await notifyClientePedido({
    recipients,
    pedidoRef: pedidoRef(after),
    nomeCliente: after.nomeCliente,
    subject: `[BInsight] Atualização — ${pedidoRef(after)}`,
    message: parts.join('<br>') || 'Há uma nova atualização no seu pedido.',
  });
}

export async function maybeNotifyDocumentUploaded(
  accessToken: string,
  kind: ClientDocKind,
  pedido: PedidoMapa
): Promise<void> {
  if (USE_MOCK_DATA || !USE_OAUTH_SHEETS) return;

  const recipients = await fetchNotifyRecipientsForCnpj(accessToken, pedido.cnpj);
  if (!recipients.length) return;

  const label = kind === 'nf' ? 'Nota Fiscal' : 'Boleto';
  await notifyClientePedido({
    recipients,
    pedidoRef: pedidoRef(pedido),
    nomeCliente: pedido.nomeCliente,
    subject: `[BInsight] ${label} disponível — ${pedidoRef(pedido)}`,
    message: `O ${label} do seu pedido já está disponível no portal BInsight Connect. Acesse <strong>Meus Pedidos</strong> e clique em Ver ${kind === 'nf' ? 'NF' : 'boleto'}.`,
  });
}
