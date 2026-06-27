import { PedidoMapa } from './constants';
import { fetchNotifyRecipientProfilesForCnpj } from './registryService';
import { notifyClientePedido } from './notifyWebApp';
import { buildTimelineEmailHtml } from './timelineEmail';

function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pedidoRef(p: PedidoMapa): string {
  return (p.numPedidoCli || p.numNF || '').trim() || `Linha ${p.rowNum}`;
}

function urlAdded(before: string | undefined, after: string | undefined): boolean {
  const b = String(before ?? '').trim();
  const a = String(after ?? '').trim();
  return Boolean(a) && a !== b;
}

function buildDocumentsMessage(nfAdded: boolean, boletoAdded: boolean): string {
  if (nfAdded && boletoAdded) {
    return (
      'A <strong>Nota Fiscal</strong> e o <strong>Boleto</strong> do seu pedido já estão disponíveis no portal BInsight Connect. ' +
      'Acesse <strong>Meus Pedidos</strong> e clique em Ver NF ou Ver boleto.'
    );
  }
  if (nfAdded) {
    return (
      'A <strong>Nota Fiscal</strong> do seu pedido já está disponível no portal BInsight Connect. ' +
      'Acesse <strong>Meus Pedidos</strong> e clique em Ver NF.'
    );
  }
  return (
    'O <strong>Boleto</strong> do seu pedido já está disponível no portal BInsight Connect. ' +
    'Acesse <strong>Meus Pedidos</strong> e clique em Ver boleto.'
  );
}

function buildDocumentsSubject(ref: string, nfAdded: boolean, boletoAdded: boolean): string {
  if (nfAdded && boletoAdded) return `[BInsight] NF e Boleto disponíveis — ${ref}`;
  if (nfAdded) return `[BInsight] Nota Fiscal disponível — ${ref}`;
  return `[BInsight] Boleto disponível — ${ref}`;
}

export async function maybeNotifyDocumentsAdded(
  before: PedidoMapa,
  after: PedidoMapa
): Promise<void> {
  const nfAdded = urlAdded(before.nfDriveUrl, after.nfDriveUrl);
  const boletoAdded = urlAdded(before.boletoDriveUrl, after.boletoDriveUrl);
  if (!nfAdded && !boletoAdded) return;

  const recipients = await fetchNotifyRecipientProfilesForCnpj(after.cnpj);
  if (!recipients.length) return;

  const ref = pedidoRef(after);
  await notifyClientePedido({
    recipients,
    pedidoRef: ref,
    nomeCliente: after.nomeCliente,
    subject: buildDocumentsSubject(ref, nfAdded, boletoAdded),
    message: buildDocumentsMessage(nfAdded, boletoAdded),
  });
}

function isFinalizadoStatus(status: string | undefined): boolean {
  return String(status ?? '')
    .trim()
    .toUpperCase()
    .includes('FINALIZADO');
}

export async function maybeNotifyPedidoChanges(
  before: PedidoMapa,
  after: PedidoMapa
): Promise<void> {
  await maybeNotifyDocumentsAdded(before, after);

  const statusChanged = (before.status ?? '').trim() !== (after.status ?? '').trim();
  const obsChanged = (before.obsCliente ?? '').trim() !== (after.obsCliente ?? '').trim();
  const pgtoChanged = (before.statusPgto ?? '').trim() !== (after.statusPgto ?? '').trim();

  const notifyStatusChange = statusChanged && !isFinalizadoStatus(after.status);

  if (!notifyStatusChange && !obsChanged && !pgtoChanged) return;

  const recipients = await fetchNotifyRecipientProfilesForCnpj(after.cnpj);
  if (!recipients.length) return;

  const parts: string[] = [];
  if (notifyStatusChange) parts.push(`Status do pedido: <strong>${escHtml(after.status || '—')}</strong>`);
  if (obsChanged && after.obsCliente)
    parts.push(`Atualização BInsight: <strong>${escHtml(after.obsCliente)}</strong>`);
  if (pgtoChanged) parts.push(`Pagamento: <strong>${escHtml(after.statusPgto || '—')}</strong>`);

  const ref = pedidoRef(after);
  await notifyClientePedido({
    recipients,
    pedidoRef: ref,
    nomeCliente: after.nomeCliente,
    subject: `[BInsight] Atualização — ${ref}`,
    message: parts.join('<br>') || 'Há uma nova atualização no seu pedido.',
    timelineHtml: notifyStatusChange ? buildTimelineEmailHtml(after) : undefined,
  });
}
