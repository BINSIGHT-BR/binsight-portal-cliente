const WEBAPP_URL = (import.meta.env.VITE_NOTIFY_WEBAPP_URL as string | undefined)?.trim() ?? '';
const NOTIFY_SECRET = (import.meta.env.VITE_NOTIFY_SECRET as string | undefined)?.trim() ?? '';

export function isNotifyConfigured(): boolean {
  return Boolean(WEBAPP_URL && NOTIFY_SECRET);
}

async function postNotify(payload: Record<string, unknown>): Promise<void> {
  if (!isNotifyConfigured()) {
    console.warn('[notify] VITE_NOTIFY_WEBAPP_URL / VITE_NOTIFY_SECRET não configurados.');
    return;
  }

  try {
    const res = await fetch(WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...payload, secret: NOTIFY_SECRET }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn('[notify] Falha HTTP', res.status, text);
    }
  } catch (err) {
    console.warn('[notify] Erro ao chamar Web App:', err);
  }
}

export async function notifyFinanceiroCadastro(payload: {
  email: string;
  nome: string;
  cnpj: string;
  notifyEmail: boolean;
}): Promise<void> {
  await postNotify({
    type: 'financeiro_cadastro',
    email: payload.email,
    nome: payload.nome,
    cnpj: payload.cnpj.replace(/\D/g, ''),
    notifyEmail: payload.notifyEmail,
  });
}

export async function notifyClientePedido(payload: {
  recipients: string[];
  pedidoRef: string;
  nomeCliente: string;
  subject: string;
  message: string;
}): Promise<void> {
  if (!payload.recipients.length) return;
  await postNotify({
    type: 'cliente_pedido',
    recipients: payload.recipients,
    pedidoRef: payload.pedidoRef,
    nomeCliente: payload.nomeCliente,
    subject: payload.subject,
    message: payload.message,
  });
}
