import { NF_INDEX_TAB, getRegistrySpreadsheetId } from './constants';
import { appendSheetRows, fetchSheetRange, updateSheetValues } from './sheetsClient';

export interface NfIndexRecord {
  rowNum: number;
  cnpj: string;
  numNF: string;
  fileId: string;
  fileName: string;
  mimeType: string;
  uploadedAt: string;
  uploadedBy: string;
  sheetRowNum: number;
}

function parseRow(row: string[], sheetRowNum: number): NfIndexRecord | null {
  const rowNum = parseInt(String(row[0] ?? ''), 10);
  const fileId = String(row[3] ?? '').trim();
  if (!rowNum || !fileId) return null;
  return {
    rowNum,
    cnpj: String(row[1] ?? '').trim(),
    numNF: String(row[2] ?? '').trim(),
    fileId,
    fileName: String(row[4] ?? '').trim(),
    mimeType: String(row[5] ?? '').trim(),
    uploadedAt: String(row[6] ?? '').trim(),
    uploadedBy: String(row[7] ?? '').trim(),
    sheetRowNum,
  };
}

export async function fetchAllNfRecords(): Promise<NfIndexRecord[]> {
  const spreadsheetId = getRegistrySpreadsheetId();
  const rows = await fetchSheetRange(spreadsheetId, `${NF_INDEX_TAB}!A2:H2000`).catch(() => []);
  return rows
    .map((row, i) => parseRow(row, i + 2))
    .filter((r): r is NfIndexRecord => r !== null);
}

export async function getNfForPedido(rowNum: number): Promise<NfIndexRecord | null> {
  const all = await fetchAllNfRecords();
  const matches = all.filter((r) => r.rowNum === rowNum);
  if (matches.length === 0) return null;
  return matches.sort((a, b) => b.sheetRowNum - a.sheetRowNum)[0];
}

export async function upsertNfIndex(entry: Omit<NfIndexRecord, 'sheetRowNum'>): Promise<void> {
  const spreadsheetId = getRegistrySpreadsheetId();
  const all = await fetchAllNfRecords();
  const existing = all.find((r) => r.rowNum === entry.rowNum);

  const row = [
    String(entry.rowNum),
    entry.cnpj,
    entry.numNF,
    entry.fileId,
    entry.fileName,
    entry.mimeType,
    entry.uploadedAt,
    entry.uploadedBy,
  ];

  if (existing) {
    await updateSheetValues(spreadsheetId, `${NF_INDEX_TAB}!A${existing.sheetRowNum}:H${existing.sheetRowNum}`, [row]);
  } else {
    await appendSheetRows(spreadsheetId, NF_INDEX_TAB, [row]);
  }
}

export async function listNfRowNums(): Promise<Set<number>> {
  const all = await fetchAllNfRecords();
  return new Set(all.map((r) => r.rowNum));
}

export async function deleteNfForPedido(rowNum: number): Promise<NfIndexRecord | null> {
  const nf = await getNfForPedido(rowNum);
  if (!nf) return null;

  const spreadsheetId = getRegistrySpreadsheetId();
  await updateSheetValues(spreadsheetId, `${NF_INDEX_TAB}!A${nf.sheetRowNum}:H${nf.sheetRowNum}`, [
    ['', '', '', '', '', '', '', ''],
  ]);
  return nf;
}
