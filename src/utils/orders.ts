import {
  getAllMapaIdsForClientRead,
  USE_MOCK_DATA,
  USE_OAUTH_SHEETS,
  yearFromDateBR,
} from '../constants/columns';
import { PedidoMapa, PortalUser } from '../types';
import { MOCK_PEDIDOS } from '../data/mockOrders';
import { fetchPedidosViaSheetAuth, isSheetSessionToken } from './connectPortalApi';
import {
  createAssinaturaOrder,
  deleteAssinaturaOrder,
  fetchAssinaturaOrdersFromSpreadsheet,
  updateAssinaturaOrder,
} from './assinaturaSheet';
import {
  createMapaOrder,
  deleteMapaOrder,
  fetchMapaOrdersFromSpreadsheet,
  updateMapaOrder,
} from './mapaSheet';
import { canAccessMapaDirectly } from './authSession';
import {
  createPedidoViaApi,
  deletePedidoViaApi,
  fetchPedidosFromApi,
  updatePedidoViaApi,
  type PedidosFilters,
} from './clienteApi';
import { normalizeCNPJ, parseSheetDate } from './ordersCore';
import { filterPedidos } from './orderFilters';

export type { PedidosFilters };
export {
  normalizeCNPJ,
  formatCNPJ,
  normalizeStatusPgto,
  pedidoToMapaRow,
  filterOrdersByCnpjs,
  isValidMapaCnpj,
  parseSheetDate,
  fmtBRL,
  isoDateToBR,
  brDateToIso,
} from './ordersCore';

export async function fetchAllOrders(
  accessToken: string,
  filters?: PedidosFilters,
  portalUser?: PortalUser | null,
  useBackendApi = false
): Promise<PedidoMapa[]> {
  if (USE_MOCK_DATA) {
    return MOCK_PEDIDOS;
  }

  if (useBackendApi) {
    return fetchPedidosFromApi(filters);
  }

  if (isSheetSessionToken(accessToken)) {
    const pedidos = await fetchPedidosViaSheetAuth(accessToken);
    return applyLocalFilters(pedidos, filters);
  }

  if (USE_OAUTH_SHEETS) {
    let pedidos: PedidoMapa[];
    const email = portalUser?.email ?? '';
    if (portalUser?.role === 'cliente' || !canAccessMapaDirectly(email)) {
      const cnpjs = portalUser?.cnpjs ?? [];
      pedidos = await fetchClientMapaOrders(accessToken, cnpjs);
    } else {
      pedidos = await fetchStaffMapaOrders(accessToken);
    }
    return applyLocalFilters(pedidos, filters);
  }

  return fetchPedidosFromApi(filters);
}

/** Lê CONSOLIDADO de mapas arquivados + corrente, filtrado por CNPJ. */
export async function fetchClientMapaOrders(
  accessToken: string,
  cnpjs: string[]
): Promise<PedidoMapa[]> {
  const allowed = new Set(
    cnpjs.map(normalizeCNPJ).filter((c) => c.length === 14)
  );
  if (allowed.size === 0) return [];

  const { withTokenRetry } = await import('./googleSheets');
  const spreadsheetIds = getAllMapaIdsForClientRead();
  const all: PedidoMapa[] = [];

  await withTokenRetry(accessToken, async (token) => {
    for (const spreadsheetId of spreadsheetIds) {
      const [pedidosBatch, assinaturasBatch] = await Promise.all([
        fetchMapaOrdersFromSpreadsheet(token, spreadsheetId),
        fetchAssinaturaOrdersFromSpreadsheet(token, spreadsheetId),
      ]);
      for (const p of [...pedidosBatch, ...assinaturasBatch]) {
        const c = normalizeCNPJ(p.cnpj);
        if (c.length === 14 && allowed.has(c)) all.push(p);
      }
    }
  });

  all.sort((a, b) => {
    const ya = a.mapaYear ?? yearFromDateBR(a.data) ?? 0;
    const yb = b.mapaYear ?? yearFromDateBR(b.data) ?? 0;
    if (yb !== ya) return yb - ya;
    const da = parseSheetDate(a.data)?.getTime() ?? 0;
    const db = parseSheetDate(b.data)?.getTime() ?? 0;
    return db - da;
  });

  return all;
}

async function fetchStaffMapaOrders(accessToken: string): Promise<PedidoMapa[]> {
  const { withTokenRetry } = await import('./googleSheets');
  const spreadsheetIds = getAllMapaIdsForClientRead();
  const all: PedidoMapa[] = [];

  await withTokenRetry(accessToken, async (token) => {
    for (const spreadsheetId of spreadsheetIds) {
      const [pedidosBatch, assinaturasBatch] = await Promise.all([
        fetchMapaOrdersFromSpreadsheet(token, spreadsheetId),
        fetchAssinaturaOrdersFromSpreadsheet(token, spreadsheetId),
      ]);
      all.push(...pedidosBatch, ...assinaturasBatch);
    }
  });

  all.sort((a, b) => {
    const ya = a.mapaYear ?? yearFromDateBR(a.data) ?? 0;
    const yb = b.mapaYear ?? yearFromDateBR(b.data) ?? 0;
    if (yb !== ya) return yb - ya;
    const da = parseSheetDate(a.data)?.getTime() ?? 0;
    const db = parseSheetDate(b.data)?.getTime() ?? 0;
    return db - da;
  });

  return all;
}

export async function createOrderRow(
  accessToken: string,
  pedido: Partial<PedidoMapa>,
  changedBy?: string
): Promise<PedidoMapa> {
  if (USE_MOCK_DATA) {
    throw new Error('Criação de pedidos não disponível em modo mock.');
  }

  if (USE_OAUTH_SHEETS) {
    if (pedido.mapaKind === 'assinatura') {
      return createAssinaturaOrder(accessToken, pedido, changedBy ?? 'financeiro');
    }
    return createMapaOrder(accessToken, pedido, changedBy ?? 'financeiro');
  }

  return createPedidoViaApi(pedido);
}

export async function updateOrderRow(
  accessToken: string,
  pedido: PedidoMapa,
  changedBy?: string,
  clientOnlyObs = false
): Promise<void> {
  if (USE_MOCK_DATA) return;

  if (USE_OAUTH_SHEETS) {
    if (clientOnlyObs) {
      throw new Error('Observação livre do cliente ainda não disponível neste modo.');
    }
    if (pedido.mapaKind === 'assinatura') {
      await updateAssinaturaOrder(accessToken, pedido, changedBy ?? 'usuario');
    } else {
      await updateMapaOrder(accessToken, pedido, changedBy ?? 'usuario', false);
    }
    return;
  }

  await updatePedidoViaApi(pedido.rowNum, pedido);
}

export async function deleteOrderRow(
  accessToken: string,
  rowNum: number,
  mapaKind: PedidoMapa['mapaKind'] = 'pedido'
): Promise<void> {
  if (USE_MOCK_DATA) {
    throw new Error('Exclusão de pedidos não disponível em modo mock.');
  }

  if (USE_OAUTH_SHEETS) {
    if (mapaKind === 'assinatura') {
      await deleteAssinaturaOrder(accessToken, rowNum);
    } else {
      await deleteMapaOrder(accessToken, rowNum);
    }
    return;
  }

  await deletePedidoViaApi(rowNum);
}

function applyLocalFilters(pedidos: PedidoMapa[], filters?: PedidosFilters): PedidoMapa[] {
  return filterPedidos(pedidos, filters);
}

/** @deprecated Use PedidoMapa */
export type PedidoVenda = PedidoMapa;
