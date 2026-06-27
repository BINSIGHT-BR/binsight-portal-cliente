const WEBAPP_URL = (import.meta.env.VITE_NOTIFY_WEBAPP_URL as string | undefined)?.trim() ?? '';
const NOTIFY_SECRET = (import.meta.env.VITE_NOTIFY_SECRET as string | undefined)?.trim() ?? '';

const CLIENTE_PEDIDO_API = '/api/notify/cliente-pedido';

export function isNotifyConfigured(): boolean {
  return Boolean(NOTIFY_SECRET);
}

async function postNotifyWebApp(payload: Record<string, unknown>): Promise<void> {
  if (!WEBAPP_URL || !NOTIFY_SECRET) {
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
      console.warn('[notify] Falha HTTP Web App', res.status, text.slice(0, 200));
    }
  } catch (err) {
    console.warn('[notify] Erro ao chamar Web App:', err);
  }
}

async function postClientePedidoApi(payload: Record<string, unknown>): Promise<void> {
  if (!NOTIFY_SECRET) {
    throw new Error('Notificação por e-mail não configurada no portal (VITE_NOTIFY_SECRET).');
  }

  const res = await fetch(CLIENTE_PEDIDO_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, secret: NOTIFY_SECRET }),
  });
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    throw new Error(`Falha ao enviar e-mail (${res.status}): ${text.slice(0, 200)}`);
  }
  try {
    const data = JSON.parse(text) as { ok?: boolean; sent?: number; error?: string };
    if (data.ok === false || data.error) {
      throw new Error(data.error ?? 'Falha ao enviar e-mail ao cliente.');
    }
    if (typeof data.sent === 'number' && data.sent === 0) {
      throw new Error('Nenhum e-mail foi enviado (verifique Gmail/SMTP nas Cloud Functions).');
    }
  } catch (parseErr) {
    if (parseErr instanceof SyntaxError) return;
    throw parseErr;
  }
}

export async function notifyFinanceiroCadastro(payload: {
  email: string;
  nome: string;
  cnpj: string;
  additionalCnpjs?: string[];
  notifyEmail: boolean;
}): Promise<void> {
  const extras = (payload.additionalCnpjs ?? [])
    .map((c) => c.replace(/\D/g, ''))
    .filter((c) => c.length === 14 && c !== payload.cnpj.replace(/\D/g, ''));
  await postNotifyWebApp({
    type: 'financeiro_cadastro',
    email: payload.email,
    nome: payload.nome,
    cnpj: payload.cnpj.replace(/\D/g, ''),
    cnpjsAdicionais: extras.join(';'),
    notifyEmail: payload.notifyEmail,
  });
}

export interface NotifyRecipientPayload {
  email: string;
  displayName?: string;
}

export async function notifyClientePedido(payload: {
  recipients: NotifyRecipientPayload[] | string[];
  pedidoRef: string;
  nomeCliente: string;
  subject: string;
  message: string;
  timelineHtml?: string;
}): Promise<void> {
  if (!payload.recipients.length) return;
  const recipients = payload.recipients.map((r) =>
    typeof r === 'string'
      ? { email: r, displayName: '' }
      : { email: r.email, displayName: r.displayName ?? '' }
  );
  await postClientePedidoApi({
    recipients,
    pedidoRef: payload.pedidoRef,
    nomeCliente: payload.nomeCliente,
    subject: payload.subject,
    message: payload.message,
    ...(payload.timelineHtml ? { timelineHtml: payload.timelineHtml } : {}),
  });
}
