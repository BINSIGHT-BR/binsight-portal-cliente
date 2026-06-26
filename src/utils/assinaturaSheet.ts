import {
  ASSINATURAS_COL_COUNT,
  ASSINATURAS_RANGE,
  ASSINATURAS_TAB,
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
import { applyDerivedFields } from './orderCalculations';
import { formatBRLForSheet, parseBRLnum } from './brl';
import { deriveStatusPgtoFromDates, normalizeStatusPgto } from './ordersCore';
import { maybeNotifyPedidoChanges } from './pedidoNotify';

export function parseAssinaturaRow(
  row: string[],
  rowNum: number,
  spreadsheetId: string
): PedidoMapa {
  const data = row[0] ?? '';
  const vencimento = String(row[13] ?? '').trim();
  return {
    mapaKind: 'assinatura',
    rowNum,
    mapaSpreadsheetId: spreadsheetId,
    mapaYear: yearFromDateBR(data) ?? undefined,
    data,
    vendedor: row[1] ?? '',
    cnpj: row[2] ?? '',
    nomeCliente: row[3] ?? '',
    tipoRecorrencia: row[4] ?? '',
    statusContrato: row[5] ?? '',
    periodicidade: row[6] ?? '',
    numPedidoCli: row[7] ?? '',
    prioridade: '',
    descricaoProduto: row[11] ?? '',
    distribuidor: row[8] ?? '',
    numPedidoDist: '',
    numContratoDist: row[12] ?? '',
    emissao: row[9] ?? '',
    numNF: (row[10] ?? '').trim(),
    vencimento,
    parc1: vencimento,
    parc2: '',
    parc3: '',
    parc4: '',
    statusPgto: normalizeStatusPgto(row[14] ?? ''),
    status: (row[15] ?? '').trim(),
    qtd: row[16] ?? '',
    custoDist: row[17] ?? '',
    totalCompra: row[18] ?? '',
    vendBins: row[19] ?? '',
    vendaTotal: row[20] ?? '',
    vendaPct: '',
    bruto: row[21] ?? '',
    liquido: '',
    statusComissao: row[22] ?? '',
    obsPedido: row[23] ?? '',
    obsCliente: '',
    nfDriveUrl: '',
    boletoDriveUrl: '',
    observacaoCliente: '',
  };
}

export function pedidoToAssinaturaRow(p: PedidoMapa): string[] {
  const venc = (p.vencimento ?? p.parc1 ?? '').trim();
  const row = [
    p.data,
    p.vendedor,
    p.cnpj,
    p.nomeCliente,
    p.tipoRecorrencia ?? 'Assinatura de Licença',
    p.statusContrato ?? 'Ativo',
    p.periodicidade ?? '',
    p.numPedidoCli,
    p.distribuidor,
    p.emissao,
    p.numNF,
    p.descricaoProduto,
    p.numContratoDist ?? p.numPedidoDist ?? '',
    venc,
    p.statusPgto,
    p.status,
    p.qtd,
    p.custoDist,
    p.totalCompra,
    p.vendBins,
    p.vendaTotal,
    p.bruto,
    p.statusComissao,
    p.obsPedido,
  ];
  while (row.length < ASSINATURAS_COL_COUNT) row.push('');
  return row.slice(0, ASSINATURAS_COL_COUNT);
}

function emptyAssinatura(rowNum: number, spreadsheetId: string): PedidoMapa {
  return parseAssinaturaRow(Array(ASSINATURAS_COL_COUNT).fill(''), rowNum, spreadsheetId);
}

export async function fetchAssinaturaOrdersFromSpreadsheet(
  accessToken: string,
  spreadsheetId: string
): Promise<PedidoMapa[]> {
  const rows = await fetchSheetRange(
    accessToken,
    spreadsheetId,
    `${ASSINATURAS_TAB}!${ASSINATURAS_RANGE}`
  );
  return rows
    .map((row, i) => parseAssinaturaRow(row, i + 2, spreadsheetId))
    .filter((p) => p.nomeCliente.trim() !== '' || p.cnpj.trim() !== '');
}

export async function fetchAssinaturaOrders(accessToken: string): Promise<PedidoMapa[]> {
  const spreadsheetId = getMapaSpreadsheetId();
  return withTokenRetry(accessToken, (token) =>
    fetchAssinaturaOrdersFromSpreadsheet(token, spreadsheetId)
  );
}

export async function createAssinaturaOrder(
  accessToken: string,
  partial: Partial<PedidoMapa>,
  _changedBy: string
): Promise<PedidoMapa> {
  const spreadsheetId = getMapaSpreadsheetId();
  return withTokenRetry(accessToken, async (token) => {
    const data = (partial.data ?? '').trim() || defaultOrderDateBR();
    const nextRow =
      (await getLastDataRow(token, spreadsheetId, ASSINATURAS_TAB)) + 1;

    const mergedPartial = applyDerivedFields(partial);
    if (mergedPartial.custoDist) {
      mergedPartial.custoDist = formatBRLForSheet(parseBRLnum(mergedPartial.custoDist));
    }
    if (mergedPartial.vendBins) {
      mergedPartial.vendBins = formatBRLForSheet(parseBRLnum(mergedPartial.vendBins));
    }

    const venc = (partial.vencimento ?? partial.parc1 ?? '').trim();
    const statusPgto =
      partial.statusPgto ??
      (venc ? deriveStatusPgtoFromDates([venc]) : 'SEM DATA');

    const pedido: PedidoMapa = {
      ...emptyAssinatura(nextRow, spreadsheetId),
      ...mergedPartial,
      mapaKind: 'assinatura',
      rowNum: nextRow,
      mapaSpreadsheetId: spreadsheetId,
      mapaYear: yearFromDateBR(data) ?? undefined,
      data,
      tipoRecorrencia: partial.tipoRecorrencia ?? 'Assinatura de Licença',
      statusContrato: partial.statusContrato ?? 'Ativo',
      vencimento: venc,
      parc1: venc,
      statusPgto: normalizeStatusPgto(statusPgto),
      emissao: partial.emissao ?? 'Não',
      status: partial.status ?? 'PENDENTE',
    };

    await appendSheetRows(token, spreadsheetId, ASSINATURAS_TAB, [pedidoToAssinaturaRow(pedido)]);
    return pedido;
  });
}

export async function updateAssinaturaOrder(
  accessToken: string,
  pedido: PedidoMapa,
  _changedBy: string
): Promise<PedidoMapa> {
  const spreadsheetId = pedido.mapaSpreadsheetId ?? getMapaSpreadsheetId();
  let before: PedidoMapa | null = null;

  const merged = await withTokenRetry(accessToken, async (token) => {
    const rows = await fetchSheetRange(
      token,
      spreadsheetId,
      `${ASSINATURAS_TAB}!A${pedido.rowNum}:X${pedido.rowNum}`
    );
    if (!rows[0]) throw new Error('Assinatura não encontrada no Mapa.');

    const existing = parseAssinaturaRow(rows[0], pedido.rowNum, spreadsheetId);
    before = existing;
    const venc = (pedido.vencimento ?? pedido.parc1 ?? existing.vencimento ?? '').trim();

    const merged: PedidoMapa = {
      ...existing,
      ...pedido,
      mapaKind: 'assinatura',
      rowNum: pedido.rowNum,
      mapaSpreadsheetId: spreadsheetId,
      mapaYear: yearFromDateBR(pedido.data ?? existing.data) ?? existing.mapaYear,
      vencimento: venc,
      parc1: venc,
      statusPgto: normalizeStatusPgto(pedido.statusPgto ?? existing.statusPgto),
    };

    await updateSheetRange(
      token,
      spreadsheetId,
      `${ASSINATURAS_TAB}!A${pedido.rowNum}:X${pedido.rowNum}`,
      [pedidoToAssinaturaRow(merged)]
    );

    return merged;
  });

  if (before) {
    void maybeNotifyPedidoChanges(accessToken, before, merged);
  }
  return merged;
}

export async function deleteAssinaturaOrder(accessToken: string, rowNum: number): Promise<void> {
  const spreadsheetId = getMapaSpreadsheetId();
  return withTokenRetry(accessToken, async (token) => {
    await deleteSheetRow(token, spreadsheetId, ASSINATURAS_TAB, rowNum);
  });
}
