import { PedidoMapa } from '../types';
import { USE_MOCK_DATA, USE_OAUTH_SHEETS } from '../constants/columns';
import { fetchNotifyRecipientProfilesForCnpj } from './registrySheet';
import { notifyClientePedido } from './notifyService';
import { buildTimelineEmailHtml } from './timelineEmail';

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
  accessToken: string,
  before: PedidoMapa,
  after: PedidoMapa
): Promise<void> {
  if (USE_MOCK_DATA || !USE_OAUTH_SHEETS) return;

  const nfAdded = urlAdded(before.nfDriveUrl, after.nfDriveUrl);
  const boletoAdded = urlAdded(before.boletoDriveUrl, after.boletoDriveUrl);
  if (!nfAdded && !boletoAdded) return;

  const recipients = await fetchNotifyRecipientProfilesForCnpj(accessToken, after.cnpj);
  if (!recipients.length) {
    console.warn('[notify] Sem destinatários NOTIFY=Sim para CNPJ', after.cnpj);
    return;
  }

  const ref = pedidoRef(after);
  await notifyClientePedido({
    recipients,
    pedidoRef: ref,
    nomeCliente: after.nomeCliente,
    subject: buildDocumentsSubject(ref, nfAdded, boletoAdded),
    message: buildDocumentsMessage(nfAdded, boletoAdded),
  });
}

/** Notifica cliente após upload/remoção de NF/boleto (retorna destinatários ou motivo). */
export async function notifyDocumentsAfterChange(
  accessToken: string,
  before: PedidoMapa,
  after: PedidoMapa
): Promise<{ emailed: string[]; skippedReason?: string }> {
  if (USE_MOCK_DATA || !USE_OAUTH_SHEETS) {
    return { emailed: [], skippedReason: 'Modo mock ou sem OAuth.' };
  }

  const nfAdded = urlAdded(before.nfDriveUrl, after.nfDriveUrl);
  const boletoAdded = urlAdded(before.boletoDriveUrl, after.boletoDriveUrl);
  if (!nfAdded && !boletoAdded) {
    return { emailed: [], skippedReason: 'Documento já estava vinculado (sem alteração de link).' };
  }

  const recipients = await fetchNotifyRecipientProfilesForCnpj(accessToken, after.cnpj);
  if (!recipients.length) {
    return {
      emailed: [],
      skippedReason: 'Nenhum e-mail ATIVO com NOTIFY=Sim para o CNPJ deste pedido.',
    };
  }

  const ref = pedidoRef(after);
  await notifyClientePedido({
    recipients,
    pedidoRef: ref,
    nomeCliente: after.nomeCliente,
    subject: buildDocumentsSubject(ref, nfAdded, boletoAdded),
    message: buildDocumentsMessage(nfAdded, boletoAdded),
  });
  return { emailed: recipients.map((r) => r.email) };
}

function isFinalizadoStatus(status: string | undefined): boolean {
  return String(status ?? '')
    .trim()
    .toUpperCase()
    .includes('FINALIZADO');
}

export async function maybeNotifyPedidoChanges(
  accessToken: string,
  before: PedidoMapa,
  after: PedidoMapa
): Promise<void> {
  if (USE_MOCK_DATA || !USE_OAUTH_SHEETS) return;

  await maybeNotifyDocumentsAdded(accessToken, before, after);

  const statusChanged = (before.status ?? '').trim() !== (after.status ?? '').trim();
  const obsChanged = (before.obsCliente ?? '').trim() !== (after.obsCliente ?? '').trim();
  const pgtoChanged = (before.statusPgto ?? '').trim() !== (after.statusPgto ?? '').trim();

  const notifyStatusChange = statusChanged && !isFinalizadoStatus(after.status);

  if (!notifyStatusChange && !obsChanged && !pgtoChanged) return;

  const recipients = await fetchNotifyRecipientProfilesForCnpj(accessToken, after.cnpj);
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
