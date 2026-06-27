/**
 * BInsight Connect — autenticação e-mail/senha (aba CLIENT_PORTAL_AUTH + log).
 * Incluir no mesmo projeto Apps Script que ConnectNotify.gs (um único doPost).
 */

var AUTH_TAB = 'CLIENT_PORTAL_AUTH';
var AUTH_LOG_TAB = 'CLIENT_PORTAL_AUTH_LOG';
var REGISTRY_TAB = 'CLIENT_PORTAL_REGISTRY';
var REGISTRY_TAB_ALT = 'CLIENT_ACCESS';
var CONSOLIDADO_TAB = 'CONSOLIDADO';
var ASSINATURAS_TAB = 'ASSINATURAS';
var SESSION_HOURS = 72;

function handleAuthPost_(body) {
  switch (body.type) {
    case 'login':
      return authLogin_(body.email, body.password);
    case 'validate_session':
      return authValidateSession_(body.sessionToken);
    case 'change_password':
      return authChangePassword_(body.sessionToken, body.oldPassword, body.newPassword);
    case 'admin_reset_password':
      return authAdminReset_(body.targetEmail, body.actorEmail);
    case 'client_pedidos':
      return authClientPedidos_(body.sessionToken);
    case 'client_drive_file':
      return authClientDriveFile_(body.sessionToken, body.driveUrl);
    case 'client_update_notify':
      return authUpdateNotify_(body.sessionToken, body.notifyEmail);
    case 'public_register':
      return authPublicRegister_(body);
    default:
      return { ok: false, error: 'Unknown auth type' };
  }
}

function authLogin_(email, password) {
  var em = normalizeEmail_(email);
  if (!em || !password) return { ok: false, error: 'Informe e-mail e senha.' };
  if (em.indexOf('@binsight.com.br') > 0) {
    return { ok: false, error: 'Equipe BInsight deve entrar com Google.' };
  }

  var cred = getAuthRow_(em);
  if (!cred) {
    logAuth_(em, 'login_fail', em, 'sem_credencial');
    return { ok: false, error: 'Senha não configurada. Peça ao financeiro para definir seu acesso.' };
  }

  if (!verifyPassword_(password, cred.salt, cred.hash)) {
    logAuth_(em, 'login_fail', em, 'senha_incorreta');
    return { ok: false, error: 'E-mail ou senha incorretos.' };
  }

  var registry = getRegistryRecord_(em);
  if (!registry) {
    logAuth_(em, 'login_fail', em, 'sem_registry');
    return { ok: false, error: 'Cadastro não encontrado. Solicite acesso no portal.' };
  }

  var status = String(registry.status || '').toUpperCase();
  if (status === 'REVOGADO') {
    logAuth_(em, 'login_fail', em, 'revogado');
    return { ok: false, error: 'Acesso revogado. Contate a BInsight.' };
  }

  var session = createSessionToken_(em);
  logAuth_(em, 'login_ok', em, status);

  return {
    ok: true,
    sessionToken: session.token,
    expiresAt: session.expiresAt,
    profile: buildProfile_(registry, cred.mustChange),
  };
}

function authValidateSession_(sessionToken) {
  var email = validateSessionToken_(sessionToken);
  if (!email) return { ok: false, error: 'Sessão expirada. Entre novamente.' };
  var registry = getRegistryRecord_(email);
  if (!registry) return { ok: false, error: 'Cadastro não encontrado.' };
  var cred = getAuthRow_(email);
  return {
    ok: true,
    profile: buildProfile_(registry, cred ? cred.mustChange : false),
  };
}

function authChangePassword_(sessionToken, oldPassword, newPassword) {
  var email = validateSessionToken_(sessionToken);
  if (!email) return { ok: false, error: 'Sessão expirada.' };
  if (!newPassword || String(newPassword).length < 6) {
    return { ok: false, error: 'A nova senha deve ter pelo menos 6 caracteres.' };
  }

  var cred = getAuthRow_(email);
  if (!cred) return { ok: false, error: 'Credencial não encontrada.' };

  var mustChange = cred.mustChange;
  if (!mustChange) {
    if (!oldPassword || !verifyPassword_(oldPassword, cred.salt, cred.hash)) {
      return { ok: false, error: 'Senha atual incorreta.' };
    }
  }

  setAuthPassword_(email, newPassword, email, false);
  logAuth_(email, 'change_password', email, '');
  return { ok: true, message: 'Senha alterada com sucesso.' };
}

function authAdminReset_(targetEmail, actorEmail) {
  var target = normalizeEmail_(targetEmail);
  var actor = normalizeEmail_(actorEmail);
  if (!target) return { ok: false, error: 'E-mail inválido.' };
  if (target.indexOf('@binsight.com.br') > 0) {
    return { ok: false, error: 'Reset disponível apenas para clientes externos.' };
  }

  var registry = getRegistryRecord_(target);
  if (!registry) return { ok: false, error: 'Cliente não encontrado no registry.' };

  var temp = generateTempPassword_();
  setAuthPassword_(target, temp, actor, true);
  logAuth_(target, 'admin_reset', actor, 'senha_temporaria');

  try {
    MailApp.sendEmail({
      to: target,
      subject: '[BInsight Connect] Nova senha de acesso',
      htmlBody:
        '<p>Olá,</p><p>Uma nova senha temporária foi definida para o portal BInsight Connect:</p>' +
        '<p><strong>' +
        esc_(temp) +
        '</strong></p><p>Acesse <a href="' +
        PORTAL_URL +
        '/login">' +
        PORTAL_URL +
        '/login</a> com seu e-mail e altere a senha em Meu perfil.</p>',
      name: 'BInsight Connect',
      replyTo: FINANCEIRO_EMAIL,
    });
  } catch (mailErr) {
    return {
      ok: true,
      tempPassword: temp,
      message: 'Senha definida. E-mail não enviado — informe a senha ao cliente manualmente.',
    };
  }

  return {
    ok: true,
    message: 'Senha temporária enviada por e-mail para ' + target + '.',
  };
}

function authClientPedidos_(sessionToken) {
  var email = validateSessionToken_(sessionToken);
  if (!email) return { ok: false, error: 'Sessão expirada.' };
  var registry = getRegistryRecord_(email);
  if (!registry || String(registry.status).toUpperCase() !== 'ATIVO') {
    return { ok: false, error: 'Acesso não liberado.' };
  }

  var cnpjs = registryCnpjs_(registry);
  var pedidos = fetchPedidosForCnpjs_(cnpjs);
  return { ok: true, pedidos: pedidos };
}

function authPublicRegister_(body) {
  var em = normalizeEmail_(body.email);
  var password = String(body.password || '');
  var firstName = String(body.nomeContato || body.firstName || '').trim();
  var lastName = String(body.sobrenomeContato || body.lastName || '').trim();
  var nome = String(body.nome || '').trim() || (firstName + ' ' + lastName).trim();
  var cnpj = normalizeCnpj_(body.cnpj);
  var notifyEmail = body.notifyEmail !== false;

  if (!em || !password) return { ok: false, error: 'Informe e-mail e senha.' };
  if (password.length < 6) return { ok: false, error: 'A senha deve ter pelo menos 6 caracteres.' };
  if (em.indexOf('@binsight.com.br') > 0) {
    return { ok: false, error: 'Clientes externos devem usar e-mail da empresa, não @binsight.com.br.' };
  }
  if (!nome) return { ok: false, error: 'Informe nome e sobrenome.' };
  if (cnpj.length !== 14) return { ok: false, error: 'Informe um CNPJ válido (14 dígitos).' };
  if (getRegistryRecord_(em)) {
    return { ok: false, error: 'Já existe um cadastro para este e-mail. Entre ou aguarde aprovação.' };
  }

  appendRegistryRow_(em, nome, cnpj, 'PENDENTE', '', '', notifyEmail, firstName, lastName);
  setAuthPassword_(em, password, em, false);
  logAuth_(em, 'public_register', em, cnpj);

  try {
    if (typeof sendFinanceiroCadastro_ === 'function') {
      sendFinanceiroCadastro_({ email: em, nome: nome, cnpj: cnpj, notifyEmail: notifyEmail });
    }
  } catch (mailErr) {
    console.warn('financeiro notify failed', mailErr);
  }

  var registry = getRegistryRecord_(em);
  var session = createSessionToken_(em);
  return {
    ok: true,
    sessionToken: session.token,
    expiresAt: session.expiresAt,
    profile: buildProfile_(registry, false),
  };
}

function appendRegistryRow_(email, nome, cnpj, status, approvedBy, approvedAt, notifyEmail, nomeContato, sobrenomeContato) {
  var ss = SpreadsheetApp.openById(getRegistrySpreadsheetId_());
  var sheet = ss.getSheetByName(REGISTRY_TAB) || ss.getSheetByName(REGISTRY_TAB_ALT);
  if (!sheet) throw new Error('Registry não encontrado.');
  sheet.appendRow([
    email,
    nome,
    cnpj,
    status || 'PENDENTE',
    approvedBy || '',
    approvedAt || '',
    '',
    notifyEmail ? 'Sim' : 'Não',
    nomeContato || '',
    sobrenomeContato || '',
  ]);
}

function authUpdateNotify_(sessionToken, notifyEmail) {
  var email = validateSessionToken_(sessionToken);
  if (!email) return { ok: false, error: 'Sessão expirada.' };
  var ss = SpreadsheetApp.openById(getRegistrySpreadsheetId_());
  var sheet = ss.getSheetByName(REGISTRY_TAB) || ss.getSheetByName(REGISTRY_TAB_ALT);
  if (!sheet) return { ok: false, error: 'Registry não encontrado.' };
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (normalizeEmail_(rows[i][0]) === email) {
      sheet.getRange(i + 1, 8).setValue(notifyEmail ? 'Sim' : 'Não');
      logAuth_(email, 'update_notify', email, notifyEmail ? 'Sim' : 'Não');
      return { ok: true, notifyEmail: !!notifyEmail };
    }
  }
  return { ok: false, error: 'Cadastro não encontrado.' };
}

function authClientDriveFile_(sessionToken, driveUrl) {
  var email = validateSessionToken_(sessionToken);
  if (!email) return { ok: false, error: 'Sessão expirada.' };
  var fileId = extractDriveId_(driveUrl);
  if (!fileId) return { ok: false, error: 'Documento inválido.' };

  try {
    var file = DriveApp.getFileById(fileId);
    var blob = file.getBlob();
    return {
      ok: true,
      name: file.getName(),
      mimeType: blob.getContentType(),
      base64: Utilities.base64Encode(blob.getBytes()),
    };
  } catch (e) {
    return { ok: false, error: 'Documento indisponível ou sem permissão.' };
  }
}

// --- Credenciais ---

function getAuthSheet_() {
  var ss = SpreadsheetApp.openById(getRegistrySpreadsheetId_());
  var sheet = ss.getSheetByName(AUTH_TAB);
  if (!sheet) throw new Error('Aba ' + AUTH_TAB + ' não encontrada.');
  return sheet;
}

function getAuthLogSheet_() {
  var ss = SpreadsheetApp.openById(getRegistrySpreadsheetId_());
  var sheet = ss.getSheetByName(AUTH_LOG_TAB);
  if (!sheet) throw new Error('Aba ' + AUTH_LOG_TAB + ' não encontrada.');
  return sheet;
}

function getAuthRow_(email) {
  var sheet = getAuthSheet_();
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (normalizeEmail_(rows[i][0]) === email) {
      return {
        rowNum: i + 1,
        hash: String(rows[i][1] || ''),
        salt: String(rows[i][2] || ''),
        mustChange: String(rows[i][5] || '').toLowerCase() === 'sim',
      };
    }
  }
  return null;
}

function setAuthPassword_(email, password, updatedBy, mustChange) {
  var hashed = hashPassword_(password);
  var sheet = getAuthSheet_();
  var existing = getAuthRow_(email);
  var now = formatNowBR_();
  var row = [
    email,
    hashed.hash,
    hashed.salt,
    now,
    updatedBy || email,
    mustChange ? 'Sim' : 'Não',
  ];

  if (existing) {
    sheet.getRange(existing.rowNum, 1, existing.rowNum, 6).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
}

function hashPassword_(password, salt) {
  salt = salt || Utilities.getUuid();
  var raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + ':' + password,
    Utilities.Charset.UTF_8
  );
  var hash = bytesToHex_(raw);
  return { salt: salt, hash: hash };
}

function verifyPassword_(password, salt, hash) {
  return hashPassword_(password, salt).hash === hash;
}

function bytesToHex_(bytes) {
  return bytes
    .map(function (b) {
      var v = (b < 0 ? b + 256 : b).toString(16);
      return v.length === 1 ? '0' + v : v;
    })
    .join('');
}

function generateTempPassword_() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  var out = '';
  for (var i = 0; i < 10; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

function logAuth_(email, action, actor, detail) {
  try {
    getAuthLogSheet_().appendRow([formatNowBR_(), email, action, actor || email, detail || '']);
  } catch (e) {
    console.warn('logAuth failed', e);
  }
}

// --- Sessão ---

function createSessionToken_(email) {
  var expiresAt = Date.now() + SESSION_HOURS * 3600000;
  var payload = JSON.stringify({ email: email, exp: expiresAt, n: Utilities.getUuid() });
  var sigBytes = Utilities.computeHmacSha256Signature(payload, getConnectSecret_());
  var token =
    Utilities.base64EncodeWebSafe(payload) + '.' + Utilities.base64EncodeWebSafe(sigBytes);
  return { token: token, expiresAt: expiresAt };
}

function validateSessionToken_(token) {
  if (!token) return null;
  var parts = String(token).split('.');
  if (parts.length !== 2) return null;
  try {
    var payload = Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString();
    var sigBytes = Utilities.base64DecodeWebSafe(parts[1]);
    var expected = Utilities.computeHmacSha256Signature(payload, getConnectSecret_());
    if (!hmacEqual_(sigBytes, expected)) return null;
    var data = JSON.parse(payload);
    if (!data.email || !data.exp || Date.now() > data.exp) return null;
    return normalizeEmail_(data.email);
  } catch (e) {
    return null;
  }
}

function hmacEqual_(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (var i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// --- Registry / pedidos ---

function getRegistrySpreadsheetId_() {
  return (
    PropertiesService.getScriptProperties().getProperty('REGISTRY_SPREADSHEET_ID') ||
    '1zifdxkwq3rYlACtKtcmuXUWtbu6X4Aq0YC-3pBRbva8'
  );
}

function getMapSpreadsheetId_() {
  return (
    PropertiesService.getScriptProperties().getProperty('MAP_SPREADSHEET_ID') ||
    '1xLp12EAjknPVJWJPNivvPfe5BQhut6jMeYr8qHJ7foI'
  );
}

function getConnectSecret_() {
  return PropertiesService.getScriptProperties().getProperty('NOTIFY_SECRET');
}

function getRegistryRecord_(email) {
  var ss = SpreadsheetApp.openById(getRegistrySpreadsheetId_());
  var sheet = ss.getSheetByName(REGISTRY_TAB) || ss.getSheetByName(REGISTRY_TAB_ALT);
  if (!sheet) return null;
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (normalizeEmail_(rows[i][0]) === email) {
      return {
        email: email,
        nome: String(rows[i][1] || ''),
        cnpj: normalizeCnpj_(rows[i][2]),
        status: String(rows[i][3] || 'PENDENTE'),
        cnpjsAdicionais: String(rows[i][6] || ''),
        notifyEmail: parseNotify_(rows[i][7]),
      };
    }
  }
  return null;
}

function registryCnpjs_(registry) {
  var set = {};
  if (registry.cnpj) {
    var primary = normalizeCnpj_(registry.cnpj);
    if (primary.length === 14) set[primary] = true;
  }
  String(registry.cnpjsAdicionais || '')
    .split(/[,;]/)
    .forEach(function (c) {
      var d = normalizeCnpj_(String(c || '').trim());
      if (d.length === 14) set[d] = true;
    });
  return Object.keys(set);
}

function buildProfile_(registry, mustChange) {
  return {
    email: registry.email,
    nome: registry.nome,
    status: String(registry.status || 'PENDENTE').toLowerCase(),
    cnpjs: registryCnpjs_(registry),
    notifyEmail: registry.notifyEmail,
    mustChangePassword: !!mustChange,
  };
}

function fetchPedidosForCnpjs_(cnpjs) {
  var allowed = {};
  cnpjs.forEach(function (c) {
    var n = normalizeCnpj_(c);
    if (n.length === 14) allowed[n] = true;
  });
  if (Object.keys(allowed).length === 0) return [];

  var ids = [getMapSpreadsheetId_()];
  var archive = PropertiesService.getScriptProperties().getProperty('MAP_ARCHIVE_IDS');
  if (archive) {
    archive.split(',').forEach(function (id) {
      id = id.trim();
      if (id) ids.push(id);
    });
  }

  var out = [];
  ids.forEach(function (spreadsheetId) {
    try {
      var ss = SpreadsheetApp.openById(spreadsheetId);
      readConsolidadoForClient_(ss, spreadsheetId, allowed, out);
      readAssinaturasForClient_(ss, spreadsheetId, allowed, out);
    } catch (e) {
      console.warn('map read fail', spreadsheetId, e);
    }
  });
  return out;
}

function readConsolidadoForClient_(ss, spreadsheetId, allowed, out) {
  var sheet = ss.getSheetByName(CONSOLIDADO_TAB);
  if (!sheet) return;
  var rows = sheet.getDataRange().getValues();
  for (var r = 1; r < rows.length; r++) {
    var row = rows[r];
    var cnpj = normalizeCnpj_(row[2]);
    if (cnpj.length !== 14 || !allowed[cnpj]) continue;
    out.push(rowToPedido_(row, r + 1, spreadsheetId));
  }
}

function readAssinaturasForClient_(ss, spreadsheetId, allowed, out) {
  var sheet = ss.getSheetByName(ASSINATURAS_TAB);
  if (!sheet) return;
  var rows = sheet.getDataRange().getValues();
  for (var r = 1; r < rows.length; r++) {
    var row = rows[r];
    var cnpj = normalizeCnpj_(row[2]);
    if (cnpj.length !== 14 || !allowed[cnpj]) continue;
    out.push(rowToAssinatura_(row, r + 1, spreadsheetId));
  }
}

function rowToAssinatura_(row, rowNum, spreadsheetId) {
  var data = String(row[0] || '');
  var year = new Date().getFullYear();
  var m = data.match(/(\d{4})/);
  if (m) year = parseInt(m[1], 10);
  var venc = String(row[13] || '').trim();
  return {
    mapaKind: 'assinatura',
    rowNum: rowNum,
    mapaYear: year,
    mapaSpreadsheetId: spreadsheetId,
    data: data,
    vendedor: String(row[1] || ''),
    cnpj: normalizeCnpj_(row[2]),
    nomeCliente: String(row[3] || ''),
    numPedidoCli: String(row[7] || ''),
    descricaoProduto: String(row[11] || ''),
    distribuidor: String(row[8] || ''),
    numContratoDist: String(row[12] || ''),
    emissao: String(row[9] || ''),
    numNF: String(row[10] || ''),
    vencimento: venc,
    parc1: venc,
    statusPgto: String(row[14] || ''),
    status: String(row[15] || ''),
    statusComissao: String(row[22] || ''),
    tipoRecorrencia: String(row[4] || ''),
    statusContrato: String(row[5] || ''),
    periodicidade: String(row[6] || ''),
    vendaTotal: String(row[20] || ''),
  };
}

function rowToPedido_(row, rowNum, spreadsheetId) {
  var data = String(row[0] || '');
  var year = new Date().getFullYear();
  var m = data.match(/(\d{4})/);
  if (m) year = parseInt(m[1], 10);
  var numPedidoCli = String(row[4] || '');
  var numPedidoDist = String(row[8] || '');
  if (!numPedidoDist && /^bin/i.test(numPedidoCli)) numPedidoDist = numPedidoCli;
  return {
    mapaKind: 'pedido',
    rowNum: rowNum,
    mapaYear: year,
    mapaSpreadsheetId: spreadsheetId,
    data: String(row[0] || ''),
    vendedor: String(row[1] || ''),
    cnpj: normalizeCnpj_(row[2]),
    nomeCliente: String(row[3] || ''),
    numPedidoCli: numPedidoCli,
    prioridade: String(row[5] || ''),
    descricaoProduto: String(row[6] || ''),
    distribuidor: String(row[7] || ''),
    numPedidoDist: numPedidoDist,
    emissao: String(row[9] || ''),
    numNF: String(row[10] || ''),
    parc1: String(row[11] || ''),
    parc2: String(row[12] || ''),
    parc3: String(row[13] || ''),
    parc4: String(row[14] || ''),
    statusPgto: String(row[15] || ''),
    status: String(row[16] || ''),
    qtd: String(row[17] || ''),
    statusComissao: String(row[25] || ''),
    obsCliente: String(row[27] || ''),
    nfDriveUrl: String(row[28] || ''),
    boletoDriveUrl: String(row[29] || ''),
  };
}

function extractDriveId_(url) {
  var raw = String(url || '');
  var patterns = [/\/file\/d\/([a-zA-Z0-9_-]+)/, /\/d\/([a-zA-Z0-9_-]+)/, /[?&]id=([a-zA-Z0-9_-]+)/];
  for (var i = 0; i < patterns.length; i++) {
    var m = raw.match(patterns[i]);
    if (m && m[1]) return m[1];
  }
  return null;
}

function normalizeEmail_(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function normalizeCnpj_(raw) {
  var digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length < 14) digits = ('00000000000000' + digits).slice(-14);
  else if (digits.length > 14) digits = digits.slice(-14);
  return digits;
}

function parseNotify_(raw) {
  var s = String(raw || '').trim().toLowerCase();
  if (s === 'não' || s === 'nao' || s === 'n') return false;
  return true;
}

function formatNowBR_() {
  return Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm:ss');
}
