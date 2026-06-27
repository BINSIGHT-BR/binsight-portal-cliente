import { NotifyRecipient } from './constants';
import { sendClientePedidoEmails } from './emailService';

export async function notifyClientePedido(payload: {
  recipients: NotifyRecipient[] | string[];
  pedidoRef: string;
  nomeCliente: string;
  subject: string;
  message: string;
  timelineHtml?: string;
}): Promise<void> {
  const list = Array.isArray(payload.recipients) ? payload.recipients : [];
  if (!list.length) return;
  await sendClientePedidoEmails(payload);
}
