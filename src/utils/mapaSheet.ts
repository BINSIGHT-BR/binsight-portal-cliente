import {
  CONSOLIDADO_RANGE,
  CONSOLIDADO_TAB,
  defaultOrderDateBR,
  getMapaSpreadsheetId,
  yearFromDateBR,
} from '../constants/columns';
import { PedidoMapa } from '../types';
import {
  appendSheetRows,
  deleteSheetRow,
  fetchSheetRange,
  getLastDataRow,
  updateSheetRange,
  withTokenRetry,
} from './googleSheets';
import {
  appendPedidoToMonthlyTab,
  deletePedidoFromMonthlyTabs,
  pedidoRowKeyFromPedido,
  upsertPedidoInMonthlyTab,
} from './monthlySync';
import { applyDerivedFields } from './orderCalculations';
import { formatBRLForSheet, parseBRLnum } from './brl';
import { cellStr, isMeaningfulMapaRow, normalizeCNPJ, normalizeStatusPgto, pedidoToMapaRow } from './ordersCore';
import { maybeNotifyPedidoChanges } from './pedidoNotify';

export function parseMapaRow(
  row: string[],
  rowNum: number,
  spreadsheetId: string
): PedidoMapa {
  const data = cellStr(row[0]);
  const numPedidoCli = cellStr(row[4]);
  const numPedidoDist = cellStr(row[8]);
  return {
    rowNum,
    mapaKind: 'pedido',
    mapaSpreadsheetId: spreadsheetId,
    mapaYear: yearFromDateBR(data) ?? undefined,
    data,
    vendedor: cellStr(row[1]),
    cnpj: normalizeCNPJ(cellStr(row[2])),
    nomeCliente: cellStr(row[3]),
    numPedidoCli,
    prioridade: cellStr(row[5]),
    descricaoProduto: cellStr(row[6]),
    distribuidor: cellStr(row[7]),
    numPedidoDist: numPedidoDist || (/^bin/i.test(numPedidoCli) ? numPedidoCli : ''),
    emissao: cellStr(row[9]),
    numNF: cellStr(row[10]),
    parc1: cellStr(row[11]),
    parc2: cellStr(row[12]),
    parc3: cellStr(row[13]),
    parc4: cellStr(row[14]),
    statusPgto: normalizeStatusPgto(cellStr(row[15])),
    status: cellStr(row[16]),
    qtd: cellStr(row[17]),
    custoDist: cellStr(row[18]),
    totalCompra: cellStr(row[19]),
    vendBins: cellStr(row[20]),
    vendaTotal: cellStr(row[21]),
    vendaPct: cellStr(row[22]),
    bruto: cellStr(row[23]),
    liquido: cellStr(row[24]),
    statusComissao: cellStr(row[25]),
    obsPedido: cellStr(row[26]),
    obsCliente: cellStr(row[27]),
    nfDriveUrl: cellStr(row[28]),
    boletoDriveUrl: cellStr(row[29]),
    observacaoCliente: '',
  };
}

function emptyPedido(rowNum: number, spreadsheetId: string): PedidoMapa {
  return parseMapaRow(Array(28).fill(''), rowNum, spreadsheetId);
}

export async function fetchMapaOrdersFromSpreadsheet(
  accessToken: string,
  spreadsheetId: string
): Promise<PedidoMapa[]> {
  const rows = await fetchSheetRange(
    accessToken,
    spreadsheetId,
    `${CONSOLIDADO_TAB}!${CONSOLIDADO_RANGE}`
  );
  return rows
    .map((row, i) => parseMapaRow(row, i + 2, spreadsheetId))
    .filter(isMeaningfulMapaRow);
}

export async function fetchMapaOrders(accessToken: string): Promise<PedidoMapa[]> {
  const spreadsheetId = getMapaSpreadsheetId();
  return withTokenRetry(accessToken, (token) =>
    fetchMapaOrdersFromSpreadsheet(token, spreadsheetId)
  );
}

export async function createMapaOrder(
  accessToken: string,
  partial: Partial<PedidoMapa>,
  _changedBy: string
): Promise<PedidoMapa> {
  const spreadsheetId = getMapaSpreadsheetId();
  return withTokenRetry(accessToken, async (token) => {
    const data = (partial.data ?? '').trim() || defaultOrderDateBR();
    const nextRow =
      (await getLastDataRow(token, spreadsheetId, CONSOLIDADO_TAB)) + 1;

    const mergedPartial = applyDerivedFields(partial);
    if (mergedPartial.custoDist) {
      mergedPartial.custoDist = formatBRLForSheet(parseBRLnum(mergedPartial.custoDist));
    }
    if (mergedPartial.vendBins) {
      mergedPartial.vendBins = formatBRLForSheet(parseBRLnum(mergedPartial.vendBins));
    }

    const pedido: PedidoMapa = {
      ...emptyPedido(nextRow, spreadsheetId),
      ...mergedPartial,
      rowNum: nextRow,
      mapaSpreadsheetId: spreadsheetId,
      mapaYear: yearFromDateBR(data) ?? undefined,
      data,
      statusPgto: normalizeStatusPgto(partial.statusPgto ?? 'SEM DATA'),
      emissao: partial.emissao ?? 'Não',
      status: partial.status ?? 'PENDENTE',
    };

    await appendSheetRows(token, spreadsheetId, CONSOLIDADO_TAB, [pedidoToMapaRow(pedido)]);

    try {
      await appendPedidoToMonthlyTab(token, spreadsheetId, pedido);
    } catch (err) {
      console.warn('[mapa] Espelho aba mensal não gravado:', err);
    }

    return pedido;
  });
}

export async function updateMapaOrder(
  accessToken: string,
  pedido: PedidoMapa,
  _changedBy: string,
  _clientOnlyObs = false,
  skipNotify = false
): Promise<PedidoMapa> {
  const spreadsheetId = pedido.mapaSpreadsheetId ?? getMapaSpreadsheetId();
  let before: PedidoMapa | null = null;

  const merged = await withTokenRetry(accessToken, async (token) => {
    const rows = await fetchSheetRange(
      token,
      spreadsheetId,
      `${CONSOLIDADO_TAB}!A${pedido.rowNum}:AD${pedido.rowNum}`
    );
    if (!rows[0]) throw new Error('Pedido não encontrado no Mapa.');

    const existing = parseMapaRow(rows[0], pedido.rowNum, spreadsheetId);
    before = existing;
    const previousKey = pedidoRowKeyFromPedido(existing);

    const merged: PedidoMapa = applyDerivedFields({
      ...existing,
      ...pedido,
      rowNum: pedido.rowNum,
      mapaSpreadsheetId: spreadsheetId,
      mapaYear: yearFromDateBR(pedido.data ?? existing.data) ?? existing.mapaYear,
      statusPgto: normalizeStatusPgto(pedido.statusPgto ?? existing.statusPgto),
    }) as PedidoMapa;

    await updateSheetRange(
      token,
      spreadsheetId,
      `${CONSOLIDADO_TAB}!A${pedido.rowNum}:AD${pedido.rowNum}`,
      [pedidoToMapaRow(merged)]
    );

    try {
      await upsertPedidoInMonthlyTab(token, spreadsheetId, merged, previousKey);
    } catch (err) {
      console.warn('[mapa] Espelho aba mensal não atualizado:', err);
    }

    return merged;
  });

  if (before && !skipNotify) {
    try {
      await maybeNotifyPedidoChanges(accessToken, before, merged);
    } catch (err) {
      console.warn('[mapa] Falha ao notificar cliente:', err);
    }
  }
  return merged;
}

export async function deleteMapaOrder(accessToken: string, rowNum: number): Promise<void> {
  const spreadsheetId = getMapaSpreadsheetId();
  return withTokenRetry(accessToken, async (token) => {
    const rows = await fetchSheetRange(
      token,
      spreadsheetId,
      `${CONSOLIDADO_TAB}!A${rowNum}:AB${rowNum}`
    );
    const existing = rows[0] ? parseMapaRow(rows[0], rowNum, spreadsheetId) : null;

    await deleteSheetRow(token, spreadsheetId, CONSOLIDADO_TAB, rowNum);

    if (existing) {
      try {
        await deletePedidoFromMonthlyTabs(token, spreadsheetId, existing);
      } catch (err) {
        console.warn('[mapa] Linha mensal não removida:', err);
      }
    }
  });
}
