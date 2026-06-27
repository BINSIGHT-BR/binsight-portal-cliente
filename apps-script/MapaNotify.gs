/**
 * BInsight Connect — notifica cliente quando col P/Q/AB/AC/AD muda na planilha Mapa.
 * Requer trigger installável (installMapaNotifyTrigger) no projeto Connect Notify.
 */

var NOTIFY_ROW_API = 'https://connect-binsight.web.app/api/notify/cliente-pedido-row';
var MAP_SPREADSHEET_ID_DEFAULT = '1xLp12EAjknPVJWJPNivvPfe5BQhut6jMeYr8qHJ7foI';

var COL_STATUS_PGTO = 16; // P
var COL_STATUS = 17; // Q
var COL_OBS_CLIENTE = 28; // AB
var COL_NF = 29; // AC
var COL_BOLETO = 30; // AD

function onEdit(e) {
  try {
    handleMapaEditNotify_(e);
  } catch (err) {
    console.error('[MapaNotify] onEdit', err);
  }
}

function handleMapaEditNotify_(e) {
  if (!e || !e.range) return;
  var col = e.range.getColumn();
  var row = e.range.getRow();
  if (row < 2) return;

  var watched = [COL_STATUS_PGTO, COL_STATUS, COL_OBS_CLIENTE, COL_NF, COL_BOLETO];
  if (watched.indexOf(col) === -1) return;

  var sheet = e.range.getSheet();
  var sheetName = sheet.getName();
  if (sheetName !== 'CONSOLIDADO' && !isMonthlyTabName_(sheetName)) return;

  var oldValue = e.oldValue != null ? String(e.oldValue) : '';
  var newValue = e.value != null ? String(e.value) : '';
  if (oldValue.trim() === newValue.trim()) return;

  var secret = PropertiesService.getScriptProperties().getProperty('NOTIFY_SECRET');
  if (!secret) {
    console.warn('[MapaNotify] NOTIFY_SECRET ausente');
    return;
  }

  var payload = {
    secret: secret,
    spreadsheetId: e.source.getId(),
    sheetName: sheetName,
    rowNum: row,
    column: col,
    oldValue: oldValue,
    newValue: newValue,
  };

  UrlFetchApp.fetch(NOTIFY_ROW_API, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
}

function isMonthlyTabName_(name) {
  var n = String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  var months = [
    'janeiro',
    'fevereiro',
    'marco',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ];
  for (var i = 0; i < months.length; i++) {
    if (n === months[i] || n.indexOf(months[i] + ' ') === 0) return true;
  }
  return false;
}

/** Executar uma vez após deploy: clasp run installMapaNotifyTrigger */
function installMapaNotifyTrigger() {
  var mapId =
    PropertiesService.getScriptProperties().getProperty('MAP_SPREADSHEET_ID') ||
    MAP_SPREADSHEET_ID_DEFAULT;
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onEdit') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('onEdit').forSpreadsheet(mapId).onEdit().create();
  return 'Mapa onEdit trigger installed for ' + mapId;
}
