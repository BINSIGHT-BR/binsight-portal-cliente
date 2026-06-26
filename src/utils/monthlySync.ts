import {
  CONSOLIDADO_COL_COUNT,
  CONSOLIDADO_TAB,
  JUNE_TAB_CANDIDATES,
  MONTH_TAB_NAMES,
  resolveMonthlyTabFromDate,
} from '../constants/columns';
import { PedidoMapa } from '../types';
import {
  appendSheetRows,
  deleteSheetRow,
  fetchSheetRange,
  listSheetTitles,
  updateSheetRange,
} from './googleSheets';
import { normalizeCNPJ, pedidoToMapaRow } from './ordersCore';

/** Chave de linha — alinhada ao pedidoRowKey_ do PortalSync.gs. */
export function pedidoRowKey(row: string[]): string {
  return [
    String(row[0] ?? ''),
    String(row[1] ?? '').trim().toLowerCase(),
    normalizeCNPJ(String(row[2] ?? '')),
    String(row[4] ?? '').trim(),
    String(row[6] ?? '').trim().slice(0, 60),
  ].join('|');
}

export function pedidoRowKeyFromPedido(p: Pick<PedidoMapa, 'data' | 'vendedor' | 'cnpj' | 'numPedidoCli' | 'descricaoProduto'>): string {
  return pedidoRowKey(pedidoToMapaRow(p as PedidoMapa));
}

function normTitle(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim();
}

function monthTabCandidates(dataBR: string): string[] {
  const base = resolveMonthlyTabFromDate(dataBR);
  if (base === CONSOLIDADO_TAB) return [];
  const m = dataBR.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const month = m ? +m[2] : 0;
  if (month === 6) return [...JUNE_TAB_CANDIDATES];
  return [base];
}

/** Resolve o título exato da aba mensal na planilha. */
export async function resolveMonthlySheetTitle(
  accessToken: string,
  spreadsheetId: string,
  dataBR: string
): Promise<string | null> {
  const candidates = monthTabCandidates(dataBR);
  if (!candidates.length) return null;

  const titles = await listSheetTitles(accessToken, spreadsheetId);
  for (const candidate of candidates) {
    const found = titles.find((t) => normTitle(t) === normTitle(candidate));
    if (found) return found;
  }
  return null;
}

export async function findRowInMonthlyTab(
  accessToken: string,
  spreadsheetId: string,
  tabName: string,
  key: string
): Promise<number | null> {
  const rows = await fetchSheetRange(
    accessToken,
    spreadsheetId,
    `${tabName}!A2:AD5000`
  ).catch(() => []);
  for (let i = 0; i < rows.length; i++) {
    if (pedidoRowKey(rows[i]) === key) return i + 2;
  }
  return null;
}

export async function appendPedidoToMonthlyTab(
  accessToken: string,
  spreadsheetId: string,
  pedido: PedidoMapa
): Promise<void> {
  const tab = await resolveMonthlySheetTitle(accessToken, spreadsheetId, pedido.data);
  if (!tab) {
    console.warn('[mapa] Aba mensal não encontrada para data:', pedido.data);
    return;
  }
  await appendSheetRows(accessToken, spreadsheetId, tab, [pedidoToMapaRow(pedido)]);
}

export async function upsertPedidoInMonthlyTab(
  accessToken: string,
  spreadsheetId: string,
  pedido: PedidoMapa,
  previousKey?: string
): Promise<void> {
  const newTab = await resolveMonthlySheetTitle(accessToken, spreadsheetId, pedido.data);
  if (!newTab) return;

  const newKey = pedidoRowKeyFromPedido(pedido);
  const oldKey = previousKey ?? newKey;

  const oldTab = previousKey
    ? await findMonthlyTabWithKey(accessToken, spreadsheetId, oldKey)
    : newTab;

  if (oldTab && oldTab !== newTab) {
    const oldRow = await findRowInMonthlyTab(accessToken, spreadsheetId, oldTab, oldKey);
    if (oldRow) await deleteSheetRow(accessToken, spreadsheetId, oldTab, oldRow);
  } else if (oldTab === newTab) {
    const existingRow = await findRowInMonthlyTab(accessToken, spreadsheetId, newTab, oldKey);
    if (existingRow) {
      await updateSheetRange(
        accessToken,
        spreadsheetId,
        `${newTab}!A${existingRow}:AD${existingRow}`,
        [pedidoToMapaRow(pedido)]
      );
      return;
    }
  }

  const already = await findRowInMonthlyTab(accessToken, spreadsheetId, newTab, newKey);
  if (already) {
    await updateSheetRange(
      accessToken,
      spreadsheetId,
      `${newTab}!A${already}:AD${already}`,
      [pedidoToMapaRow(pedido)]
    );
  } else {
    await appendSheetRows(accessToken, spreadsheetId, newTab, [pedidoToMapaRow(pedido)]);
  }
}

async function findMonthlyTabWithKey(
  accessToken: string,
  spreadsheetId: string,
  key: string
): Promise<string | null> {
  const titles = await listSheetTitles(accessToken, spreadsheetId);
  const monthSet = new Set(
    [...MONTH_TAB_NAMES, ...JUNE_TAB_CANDIDATES].map(normTitle)
  );
  for (const tab of titles) {
    if (!monthSet.has(normTitle(tab))) continue;
    const row = await findRowInMonthlyTab(accessToken, spreadsheetId, tab, key);
    if (row) return tab;
  }
  return null;
}

export async function deletePedidoFromMonthlyTabs(
  accessToken: string,
  spreadsheetId: string,
  pedido: Pick<PedidoMapa, 'data' | 'vendedor' | 'cnpj' | 'numPedidoCli' | 'descricaoProduto'>
): Promise<void> {
  const key = pedidoRowKeyFromPedido(pedido);
  const tab = await findMonthlyTabWithKey(accessToken, spreadsheetId, key);
  if (!tab) return;
  const rowNum = await findRowInMonthlyTab(accessToken, spreadsheetId, tab, key);
  if (rowNum) await deleteSheetRow(accessToken, spreadsheetId, tab, rowNum);
}

/** Normaliza largura da linha para gravação no Mapa. */
export function normalizeMapaRow(row: string[]): string[] {
  const out = row.slice(0, CONSOLIDADO_COL_COUNT);
  while (out.length < CONSOLIDADO_COL_COUNT) out.push('');
  return out;
}
