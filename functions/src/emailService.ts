import { google } from 'googleapis';
import { FINANCEIRO_EMAIL, ClientPortalRecord, NotifyRecipient } from './constants';
import { greetingFirstName } from './clientContact';

const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.send'];
const PORTAL_URL = 'https://connect-binsight.web.app';
const DEFAULT_SERVICE_ACCOUNT = '876892830548-compute@developer.gserviceaccount.com';

function delegatedSender(): string {
  return (process.env.GMAIL_DELEGATED_USER ?? FINANCEIRO_EMAIL).trim().toLowerCase();
}

function buildRegistrationHtml(record: ClientPortalRecord): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px;">
      <h2 style="color: #5b21b6;">Nova solicitação — BInsight Connect</h2>
      <p>Um cliente solicitou acesso ao portal de acompanhamento de pedidos.</p>
      <table style="border-collapse: collapse; width: 100%; margin-top: 16px;">
        <tr><td style="padding: 6px 0; color: #64748b;">E-mail</td><td><strong>${record.email}</strong></td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Nome</td><td>${record.nome || '—'}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">CNPJ</td><td style="font-family: monospace;">${record.cnpj}</td></tr>
      </table>
      <p style="margin-top: 20px; font-size: 13px; color: #64748b;">
        Aprove ou revogue em <a href="https://connect-binsight.web.app/admin/acessos">Admin → Acessos</a>.
      </p>
    </div>
  `.trim();
}

function encodeRawMessage(to: string, subject: string, html: string, from: string): string {
  const lines = [
    `From: BInsight Financeiro <${from}>`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
  ];
  lines.push('', html);
  return Buffer.from(lines.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function parseServiceAccountCreds(): { client_email: string; private_key: string } | null {
  const raw = process.env.GMAIL_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    const creds = JSON.parse(raw) as { client_email?: string; private_key?: string };
    if (!creds.client_email || !creds.private_key) return null;
    return { client_email: creds.client_email, private_key: creds.private_key };
  } catch {
    console.error('[email] GMAIL_SERVICE_ACCOUNT_JSON inválido (JSON malformado).');
    return null;
  }
}

async function getGmailClient() {
  const subject = delegatedSender();
  const creds = parseServiceAccountCreds();

  if (creds) {
    const auth = new google.auth.JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: GMAIL_SCOPES,
      subject,
    });
    return google.gmail({ version: 'v1', auth });
  }

  console.warn(
    '[email] GMAIL_SERVICE_ACCOUNT_JSON ausente — tentando ADC (pode falhar no Cloud Functions). ' +
      `Use chave JSON da SA ${DEFAULT_SERVICE_ACCOUNT}.`
  );
  const auth = new google.auth.GoogleAuth({
    scopes: GMAIL_SCOPES,
    clientOptions: { subject },
  });
  return google.gmail({ version: 'v1', auth });
}

async function sendViaGmail(to: string, subject: string, html: string): Promise<void> {
  const from = delegatedSender();
  const gmail = await getGmailClient();
  await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodeRawMessage(to, subject, html, from),
    },
  });
}

async function sendViaSmtp(to: string, subject: string, html: string): Promise<void> {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass) {
    throw new Error('SMTP não configurado (SMTP_HOST, SMTP_USER, SMTP_PASS).');
  }
  const nodemailer = await import('nodemailer');
  const port = parseInt(process.env.SMTP_PORT ?? '587', 10);
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? user,
    to,
    subject,
    html,
  });
}

function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildGreeting(displayName?: string): string {
  const first = greetingFirstName(displayName ?? '');
  return first ? `Olá, ${escHtml(first)},` : 'Olá,';
}

function buildClientePedidoHtml(payload: {
  pedidoRef: string;
  nomeCliente: string;
  message: string;
  timelineHtml?: string;
  recipientName?: string;
}): string {
  const timelineBlock = payload.timelineHtml
    ? `<div style="margin:20px 0;">${payload.timelineHtml}</div>`
    : '';
  return (
    `<div style="font-family:Arial,sans-serif;max-width:600px;color:#1e293b;">` +
    `<p>${buildGreeting(payload.recipientName)}</p>` +
    `<p>${payload.message}</p>` +
    timelineBlock +
    `<p style="margin-top:20px;"><strong>Referência:</strong> ${escHtml(payload.pedidoRef)}` +
    `<br><strong>Cliente:</strong> ${escHtml(payload.nomeCliente)}</p>` +
    `<p><a href="${PORTAL_URL}/pedidos" style="display:inline-block;padding:10px 20px;background:#7c3aed;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;">Abrir Meus Pedidos</a></p>` +
    `<p style="color:#666;font-size:12px;margin-top:24px;">Enviado por BInsight Financeiro. ` +
    `Para parar de receber estes e-mails, acesse Meu perfil no portal.</p>` +
    `</div>`
  );
}

/** E-mails ao cliente sobre pedido — remetente financeiro@ (Gmail API delegação). */
export async function sendClientePedidoEmails(payload: {
  recipients: NotifyRecipient[] | string[];
  pedidoRef: string;
  nomeCliente: string;
  subject: string;
  message: string;
  timelineHtml?: string;
}): Promise<{ sent: number; failed: string[] }> {
  const normalized: NotifyRecipient[] = payload.recipients.map((r) =>
    typeof r === 'string'
      ? { email: r.trim().toLowerCase(), displayName: '' }
      : { email: r.email.trim().toLowerCase(), displayName: r.displayName.trim() }
  ).filter((r) => r.email);
  if (!normalized.length) return { sent: 0, failed: [] };

  let sent = 0;
  const failed: string[] = [];

  for (const recipient of normalized) {
    const html = buildClientePedidoHtml({
      pedidoRef: payload.pedidoRef,
      nomeCliente: payload.nomeCliente,
      message: payload.message,
      timelineHtml: payload.timelineHtml,
      recipientName: recipient.displayName,
    });
    try {
      await sendViaGmail(recipient.email, payload.subject, html);
      console.log('[email] Cliente pedido enviado via Gmail para', recipient.email);
      sent += 1;
    } catch (gmailErr) {
      const gmailMsg = gmailErr instanceof Error ? gmailErr.message : String(gmailErr);
      console.warn('[email] Gmail falhou para', recipient.email, gmailMsg);
      try {
        await sendViaSmtp(recipient.email, payload.subject, html);
        console.log('[email] Cliente pedido enviado via SMTP para', recipient.email);
        sent += 1;
      } catch (smtpErr) {
        const smtpMsg = smtpErr instanceof Error ? smtpErr.message : String(smtpErr);
        console.error('[email] Falha ao notificar cliente', recipient.email, smtpMsg);
        failed.push(`${recipient.email}: Gmail: ${gmailMsg}; SMTP: ${smtpMsg}`);
      }
    }
  }

  return { sent, failed };
}

/**
 * Notifica financeiro@ sobre nova solicitação de acesso.
 * Gmail API (domain-wide delegation) ou SMTP via env vars.
 */
export async function notifyFinanceiroNewRegistration(
  record: ClientPortalRecord
): Promise<void> {
  const to = FINANCEIRO_EMAIL;
  const subject = `[BInsight Connect] Nova solicitação — ${record.nome || record.email}`;
  const html = buildRegistrationHtml(record);

  try {
    await sendViaGmail(to, subject, html);
    console.log('[email] Notificação enviada via Gmail API para', to);
    return;
  } catch (gmailErr) {
    console.warn('[email] Gmail API falhou, tentando SMTP…', gmailErr);
  }

  try {
    await sendViaSmtp(to, subject, html);
    console.log('[email] Notificação enviada via SMTP para', to);
  } catch (smtpErr) {
    console.error('[email] Falha total no envio — cadastro gravado na planilha', {
      to,
      email: record.email,
      error: smtpErr instanceof Error ? smtpErr.message : smtpErr,
    });
  }
}

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
  const subject = 'Redefinir senha — BInsight Connect';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px;">
      <h2 style="color: #5b21b6;">Redefinição de senha</h2>
      <p>Recebemos uma solicitação para redefinir a senha da sua conta no BInsight Connect.</p>
      <p><a href="${resetLink}" style="display:inline-block;padding:12px 24px;background:#5b21b6;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">Redefinir senha</a></p>
      <p style="font-size: 13px; color: #64748b;">Se você não solicitou, ignore este e-mail.</p>
    </div>
  `.trim();

  try {
    await sendViaGmail(to, subject, html);
  } catch {
    await sendViaSmtp(to, subject, html);
  }
}
