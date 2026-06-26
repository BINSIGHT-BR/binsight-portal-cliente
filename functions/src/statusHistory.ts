import { getRegistrySpreadsheetId, STATUS_HISTORY_TAB } from './constants';
import {
  appendSheetRows,
  fetchSheetRange,
  updateSheetValues,
} from './sheetsClient';

export interface StatusHistoryEntry {
  timestamp: string;
  rowNum: number;
  pedidoRef: string;
  field: 'status' | 'obsCliente';
  oldValue: string;
  newValue: string;
  changedBy: string;
}

function nowBR(): string {
  const d = new Date();
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export async function appendStatusHistory(entries: StatusHistoryEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const spreadsheetId = getRegistrySpreadsheetId();
  const rows = entries.map((e) => [
    e.timestamp,
    String(e.rowNum),
    e.pedidoRef,
    e.field,
    e.oldValue,
    e.newValue,
    e.changedBy,
  ]);
  try {
    await appendSheetRows(spreadsheetId, STATUS_HISTORY_TAB, rows);
  } catch (err) {
    console.warn('[statusHistory] Falha ao gravar histórico (aba STATUS_HISTORY existe?)', err);
  }
}

export function diffStatusFields(
  rowNum: number,
  pedidoRef: string,
  changedBy: string,
  before: { status: string; obsCliente: string },
  after: { status: string; obsCliente: string }
): StatusHistoryEntry[] {
  const ts = nowBR();
  const entries: StatusHistoryEntry[] = [];
  const oldStatus = (before.status ?? '').trim();
  const newStatus = (after.status ?? '').trim();
  if (oldStatus !== newStatus) {
    entries.push({
      timestamp: ts,
      rowNum,
      pedidoRef,
      field: 'status',
      oldValue: oldStatus,
      newValue: newStatus,
      changedBy,
    });
  }
  const oldObs = (before.obsCliente ?? '').trim();
  const newObs = (after.obsCliente ?? '').trim();
  if (oldObs !== newObs) {
    entries.push({
      timestamp: ts,
      rowNum,
      pedidoRef,
      field: 'obsCliente',
      oldValue: oldObs,
      newValue: newObs,
      changedBy,
    });
  }
  return entries;
}

/** Cabeçalho sugerido para aba STATUS_HISTORY: timestamp | rowNum | pedidoRef | field | oldValue | newValue | changedBy */
export async function fetchStatusHistoryForRow(rowNum: number): Promise<StatusHistoryEntry[]> {
  const spreadsheetId = getRegistrySpreadsheetId();
  const rows = await fetchSheetRange(spreadsheetId, `${STATUS_HISTORY_TAB}!A2:G5000`).catch(
    () => []
  );
  return rows
    .map((row) => ({
      timestamp: String(row[0] ?? ''),
      rowNum: parseInt(String(row[1] ?? ''), 10),
      pedidoRef: String(row[2] ?? ''),
      field: String(row[3] ?? '') as 'status' | 'obsCliente',
      oldValue: String(row[4] ?? ''),
      newValue: String(row[5] ?? ''),
      changedBy: String(row[6] ?? ''),
    }))
    .filter((e) => e.rowNum === rowNum)
    .reverse();
}

export async function ensureStatusHistoryHeader(): Promise<void> {
  const spreadsheetId = getRegistrySpreadsheetId();
  const existing = await fetchSheetRange(spreadsheetId, `${STATUS_HISTORY_TAB}!A1:G1`).catch(
    () => []
  );
  if (existing.length > 0) return;
  await updateSheetValues(spreadsheetId, `${STATUS_HISTORY_TAB}!A1:G1`, [
    ['timestamp', 'rowNum', 'pedidoRef', 'field', 'oldValue', 'newValue', 'changedBy'],
  ]);
}
