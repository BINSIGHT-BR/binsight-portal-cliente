import { google } from 'googleapis';
import { FINANCEIRO_EMAIL, ClientPortalRecord, NotifyRecipient } from './constants';
import { greetingFirstName } from './clientContact';

const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.send'];
const PORTAL_URL = 'https://connect-binsight.web.app';
const COMPANY_SITE = 'https://www.binsight.com.br';
const DEFAULT_SERVICE_ACCOUNT = '876892830548-compute@developer.gserviceaccount.com';
const FROM_DISPLAY = 'BInsight Financeiro';

interface EmailBody {
  html: string;
  text: string;
}

function delegatedSender(): string {
  return (process.env.GMAIL_DELEGATED_USER ?? FINANCEIRO_EMAIL).trim().toLowerCase();
}

function listUnsubscribeHeader(): string {
  return `<${PORTAL_URL}/perfil>, <mailto:${FINANCEIRO_EMAIL}?subject=desinscrever-notificacoes>`;
}

function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildEmailFooterHtml(): string {
  return (
    `<hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0 16px;">` +
    `<p style="color:#64748b;font-size:12px;line-height:1.5;margin:0;">` +
    `<strong style="color:#475569;">BInsight Connect</strong><br>` +
    `Portal de acompanhamento de pedidos · ${COMPANY_SITE}<br>` +
    `Dúvidas: <a href="mailto:${FINANCEIRO_EMAIL}" style="color:#7c3aed;">${FINANCEIRO_EMAIL}</a><br>` +
    `<span style="font-size:11px;">Para gerenciar notificações, acesse Meu perfil no portal.</span>` +
    `</p>`
  );
}

function buildEmailFooterText(): string {
  return (
    `---\n` +
    `BInsight Connect — portal de acompanhamento de pedidos\n` +
    `${COMPANY_SITE}\n` +
    `Dúvidas: ${FINANCEIRO_EMAIL}\n` +
    `Gerenciar notificações: ${PORTAL_URL}/perfil`
  );
}

function wrapHtmlEmail(title: string, innerHtml: string): string {
  return (
    `<!DOCTYPE html>` +
    `<html lang="pt-BR"><head><meta charset="UTF-8"></head>` +
    `<body style="margin:0;padding:0;background:#f8fafc;">` +
    `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px 16px;color:#1e293b;">` +
    `<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:24px;">` +
    `<p style="margin:0 0 16px;font-size:13px;font-weight:bold;color:#7c3aed;letter-spacing:0.02em;">BINSIGHT CONNECT</p>` +
    `<h2 style="margin:0 0 16px;font-size:18px;color:#0f172a;">${escHtml(title)}</h2>` +
    innerHtml +
    buildEmailFooterHtml() +
    `</div></div></body></html>`
  );
}

function wrapTextEmail(title: string, innerText: string): string {
  return `${title}\n\n${innerText}\n\n${buildEmailFooterText()}`;
}

function buildGreetingHtml(displayName?: string): string {
  const first = greetingFirstName(displayName ?? '');
  return first ? `Olá, ${escHtml(first)},` : 'Olá,';
}

function buildGreetingText(displayName?: string): string {
  const first = greetingFirstName(displayName ?? '');
  return first ? `Olá, ${first},` : 'Olá,';
}

function buildRegistrationEmail(record: ClientPortalRecord): EmailBody {
  const innerHtml =
    `<p style="margin:0 0 12px;line-height:1.5;">Um cliente solicitou acesso ao portal de acompanhamento de pedidos.</p>` +
    `<table style="border-collapse:collapse;width:100%;margin-top:12px;font-size:14px;">` +
    `<tr><td style="padding:6px 0;color:#64748b;width:90px;">E-mail</td><td><strong>${escHtml(record.email)}</strong></td></tr>` +
    `<tr><td style="padding:6px 0;color:#64748b;">Nome</td><td>${escHtml(record.nome || '—')}</td></tr>` +
    `<tr><td style="padding:6px 0;color:#64748b;">CNPJ</td><td style="font-family:monospace;">${escHtml(record.cnpj)}</td></tr>` +
    `</table>` +
    `<p style="margin-top:20px;font-size:13px;line-height:1.5;">` +
    `Aprove ou revogue em <a href="${PORTAL_URL}/admin/acessos" style="color:#7c3aed;">Admin → Acessos</a>.` +
    `</p>`;

  const innerText =
    `Um cliente solicitou acesso ao portal de acompanhamento de pedidos.\n\n` +
    `E-mail: ${record.email}\n` +
    `Nome: ${record.nome || '—'}\n` +
    `CNPJ: ${record.cnpj}\n\n` +
    `Aprove ou revogue em: ${PORTAL_URL}/admin/acessos`;

  return {
    html: wrapHtmlEmail('Nova solicitação de acesso', innerHtml),
    text: wrapTextEmail('Nova solicitação de acesso', innerText),
  };
}

function buildClientePedidoEmail(payload: {
  pedidoRef: string;
  nomeCliente: string;
  message: string;
  timelineHtml?: string;
  recipientName?: string;
}): EmailBody {
  const timelineBlock = payload.timelineHtml
    ? `<div style="margin:20px 0;">${payload.timelineHtml}</div>`
    : '';

  const innerHtml =
    `<p style="margin:0 0 12px;line-height:1.5;">${buildGreetingHtml(payload.recipientName)}</p>` +
    `<p style="margin:0 0 12px;line-height:1.5;">${payload.message}</p>` +
    timelineBlock +
    `<p style="margin:16px 0;line-height:1.5;">` +
    `<strong>Referência:</strong> ${escHtml(payload.pedidoRef)}<br>` +
    `<strong>Cliente:</strong> ${escHtml(payload.nomeCliente)}` +
    `</p>` +
    `<p style="margin:20px 0;">` +
    `<a href="${PORTAL_URL}/pedidos" style="display:inline-block;padding:10px 20px;background:#7c3aed;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;">Abrir Meus Pedidos</a>` +
    `</p>`;

  const timelineText = payload.timelineHtml
    ? `\n${stripHtml(payload.timelineHtml)}\n`
    : '';

  const innerText =
    `${buildGreetingText(payload.recipientName)}\n\n` +
    `${stripHtml(payload.message)}` +
    timelineText +
    `\nReferência: ${payload.pedidoRef}\n` +
    `Cliente: ${payload.nomeCliente}\n\n` +
    `Abrir Meus Pedidos: ${PORTAL_URL}/pedidos`;

  return {
    html: wrapHtmlEmail('Atualização do seu pedido', innerHtml),
    text: wrapTextEmail('Atualização do seu pedido', innerText),
  };
}

function buildPasswordResetEmail(resetLink: string): EmailBody {
  const innerHtml =
    `<p style="margin:0 0 12px;line-height:1.5;">Recebemos uma solicitação para redefinir a senha da sua conta no BInsight Connect.</p>` +
    `<p style="margin:20px 0;">` +
    `<a href="${resetLink}" style="display:inline-block;padding:12px 24px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">Redefinir senha</a>` +
    `</p>` +
    `<p style="margin:0;font-size:13px;color:#64748b;line-height:1.5;">Se você não solicitou, ignore este e-mail.</p>`;

  const innerText =
    `Recebemos uma solicitação para redefinir a senha da sua conta no BInsight Connect.\n\n` +
    `Redefinir senha: ${resetLink}\n\n` +
    `Se você não solicitou, ignore este e-mail.`;

  return {
    html: wrapHtmlEmail('Redefinição de senha', innerHtml),
    text: wrapTextEmail('Redefinição de senha', innerText),
  };
}

function encodeRawMessage(to: string, subject: string, from: string, body: EmailBody): string {
  const boundary = `binsight_${Date.now().toString(36)}`;
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`;

  const headers = [
    `From: ${FROM_DISPLAY} <${from}>`,
    `To: ${to}`,
    `Reply-To: ${FINANCEIRO_EMAIL}`,
    `List-Unsubscribe: ${listUnsubscribeHeader()}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  const parts = [
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(body.text, 'utf8').toString('base64'),
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(body.html, 'utf8').toString('base64'),
    `--${boundary}--`,
  ];

  return Buffer.from([...headers, '', ...parts].join('\r\n'))
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

async function sendViaGmail(to: string, subject: string, body: EmailBody): Promise<void> {
  const from = delegatedSender();
  const gmail = await getGmailClient();
  await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodeRawMessage(to, subject, from, body),
    },
  });
}

async function sendViaSmtp(to: string, subject: string, body: EmailBody): Promise<void> {
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
    from: `"${FROM_DISPLAY}" <${process.env.SMTP_FROM ?? user}>`,
    replyTo: FINANCEIRO_EMAIL,
    to,
    subject,
    text: body.text,
    html: body.html,
    headers: {
      'List-Unsubscribe': listUnsubscribeHeader(),
    },
  });
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
  const normalized: NotifyRecipient[] = payload.recipients
    .map((r) =>
      typeof r === 'string'
        ? { email: r.trim().toLowerCase(), displayName: '' }
        : { email: r.email.trim().toLowerCase(), displayName: r.displayName.trim() }
    )
    .filter((r) => r.email);
  if (!normalized.length) return { sent: 0, failed: [] };

  let sent = 0;
  const failed: string[] = [];

  for (const recipient of normalized) {
    const body = buildClientePedidoEmail({
      pedidoRef: payload.pedidoRef,
      nomeCliente: payload.nomeCliente,
      message: payload.message,
      timelineHtml: payload.timelineHtml,
      recipientName: recipient.displayName,
    });
    try {
      await sendViaGmail(recipient.email, payload.subject, body);
      console.log('[email] Cliente pedido enviado via Gmail para', recipient.email);
      sent += 1;
    } catch (gmailErr) {
      const gmailMsg = gmailErr instanceof Error ? gmailErr.message : String(gmailErr);
      console.warn('[email] Gmail falhou para', recipient.email, gmailMsg);
      try {
        await sendViaSmtp(recipient.email, payload.subject, body);
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
  const body = buildRegistrationEmail(record);

  try {
    await sendViaGmail(to, subject, body);
    console.log('[email] Notificação enviada via Gmail API para', to);
    return;
  } catch (gmailErr) {
    console.warn('[email] Gmail API falhou, tentando SMTP…', gmailErr);
  }

  try {
    await sendViaSmtp(to, subject, body);
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
  const body = buildPasswordResetEmail(resetLink);

  try {
    await sendViaGmail(to, subject, body);
  } catch {
    await sendViaSmtp(to, subject, body);
  }
}
