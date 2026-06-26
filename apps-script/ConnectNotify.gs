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
  var html =
    '<p>Olá,</p>' +
    '<p>' +
    (data.message || '') +
    '</p>' +
    '<p><strong>Referência:</strong> ' +
    esc_(ref) +
    '<br><strong>Cliente:</strong> ' +
    esc_(data.nomeCliente || '') +
    '</p>' +
    '<p><a href="' +
    PORTAL_URL +
    '/pedidos">Abrir Meus Pedidos no BInsight Connect</a></p>' +
    '<p style="color:#666;font-size:12px;">Enviado por BInsight Financeiro. ' +
    'Para parar de receber estes e-mails, acesse Meu perfil no portal.</p>';

  for (var i = 0; i < recipients.length; i++) {
    MailApp.sendEmail({
      to: recipients[i],
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
    '___NOTIFY_SECRET_PLACEHOLDER___'
  );
  return 'NOTIFY_SECRET configured';
}
