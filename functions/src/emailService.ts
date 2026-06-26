import { google } from 'googleapis';
import { FINANCEIRO_EMAIL, ClientPortalRecord } from './constants';

const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

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
    `From: BInsight Connect <${from}>`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    '',
    html,
  ];
  return Buffer.from(lines.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function getGmailClient() {
  const auth = new google.auth.GoogleAuth({ scopes: GMAIL_SCOPES });
  const client = await auth.getClient();
  if (client instanceof google.auth.JWT) {
    client.subject = delegatedSender();
  }
  return google.gmail({ version: 'v1', auth: client as Parameters<typeof google.gmail>[0]['auth'] });
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
