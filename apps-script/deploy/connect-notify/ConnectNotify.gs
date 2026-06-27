/**
 * BInsight Connect — notificações por e-mail (sem Blaze).
 * Deploy como Web App executando como financeiro@binsight.com.br.
 *
 * Script property NOTIFY_SECRET = mesmo valor de VITE_NOTIFY_SECRET no portal.
 */

var PORTAL_URL = 'https://connect-binsight.web.app';
var FINANCEIRO_EMAIL = 'financeiro@binsight.com.br';

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var secret = PropertiesService.getScriptProperties().getProperty('NOTIFY_SECRET');
    if (!secret || body.secret !== secret) {
      return jsonOut({ ok: false, error: 'Unauthorized' }, 401);
    }

    switch (body.type) {
      case 'financeiro_cadastro':
        sendFinanceiroCadastro_(body);
        break;
      case 'cliente_pedido':
        sendClientePedido_(body);
        break;
      case 'login':
      case 'validate_session':
      case 'change_password':
      case 'admin_reset_password':
      case 'client_pedidos':
      case 'client_drive_file':
      case 'client_update_notify':
      case 'public_register':
        return jsonOut(handleAuthPost_(body));
      default:
        return jsonOut({ ok: false, error: 'Unknown type' }, 400);
    }

    return jsonOut({ ok: true });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) }, 500);
  }
}

function sendFinanceiroCadastro_(data) {
  var cnpjFmt = formatCnpj_(data.cnpj);
  var html =
    '<p>Novo cadastro no <strong>BInsight Connect</strong>.</p>' +
    '<ul>' +
    '<li><strong>Nome:</strong> ' + esc_(data.nome) + '</li>' +
    '<li><strong>E-mail:</strong> ' + esc_(data.email) + '</li>' +
    '<li><strong>CNPJ:</strong> ' + esc_(cnpjFmt) + '</li>' +
    '<li><strong>Notificações:</strong> ' + esc_(data.notifyEmail ? 'Sim' : 'Não') + '</li>' +
    '</ul>' +
    '<p><a href="' +
    PORTAL_URL +
    '/admin/acessos">Aprovar em Acessos Clientes</a></p>';

  MailApp.sendEmail({
    to: FINANCEIRO_EMAIL,
    subject: '[Connect] Cadastro pendente — ' + data.nome,
    htmlBody: html,
    name: 'BInsight Connect',
    replyTo: FINANCEIRO_EMAIL,
  });
}

function sendClientePedido_(data) {
  var recipients = data.recipients || [];
  if (!recipients.length) return;

  var ref = data.pedidoRef || 'Pedido';
  var subject = data.subject || '[BInsight] Atualização do seu pedido';
  var timelineBlock = data.timelineHtml
    ? '<div style="margin:20px 0;">' + data.timelineHtml + '</div>'
    : '';
  var recipientNames = data.recipientNames || {};

  for (var i = 0; i < recipients.length; i++) {
    var to = recipients[i];
    var displayName = recipientNames[to] || (typeof to === 'object' ? to.displayName : '') || '';
    if (typeof to === 'object' && to.email) {
      displayName = to.displayName || displayName;
      to = to.email;
    }
    var firstName = String(displayName || '')
      .trim()
      .split(/\s+/)[0];
    var greeting = firstName ? 'Olá, ' + esc_(firstName) + ',' : 'Olá,';
    var html =
      '<div style="font-family:Arial,sans-serif;max-width:600px;color:#1e293b;">' +
      '<p>' +
      greeting +
      '</p>' +
      '<p>' +
      (data.message || '') +
      '</p>' +
      timelineBlock +
      '<p style="margin-top:20px;"><strong>Referência:</strong> ' +
      esc_(ref) +
      '<br><strong>Cliente:</strong> ' +
      esc_(data.nomeCliente || '') +
      '</p>' +
      '<p><a href="' +
      PORTAL_URL +
      '/pedidos" style="display:inline-block;padding:10px 20px;background:#7c3aed;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;">Abrir Meus Pedidos</a></p>' +
      '<p style="color:#666;font-size:12px;margin-top:24px;">Enviado por BInsight Financeiro. ' +
      'Para parar de receber estes e-mails, acesse Meu perfil no portal.</p>' +
      '</div>';

    MailApp.sendEmail({
      to: to,
      subject: subject,
      htmlBody: html,
      name: 'BInsight Financeiro',
      replyTo: FINANCEIRO_EMAIL,
    });
  }
}

function jsonOut(obj, code) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function esc_(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatCnpj_(digits) {
  var d = String(digits || '').replace(/\D/g, '');
  if (d.length !== 14) return digits;
  return (
    d.slice(0, 2) +
    '.' +
    d.slice(2, 5) +
    '.' +
    d.slice(5, 8) +
    '/' +
    d.slice(8, 12) +
    '-' +
    d.slice(12)
  );
}

/** Executar uma vez após deploy: clasp run installNotifySecret */
function installNotifySecret() {
  var secret = PropertiesService.getScriptProperties().getProperty('NOTIFY_SECRET');
  if (secret) return 'NOTIFY_SECRET already set';
  PropertiesService.getScriptProperties().setProperty(
    'NOTIFY_SECRET',
    '503107e0a99e3a4a9a1cceb47e9d1f3aca411e4351aa1df5'
  );
  return 'NOTIFY_SECRET configured';
}
