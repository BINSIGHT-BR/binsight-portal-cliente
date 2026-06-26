import {
  AuthContext,
  CONSOLIDADO_TAB,
  PedidoMapa,
  PedidosQueryParams,
  SPREADSHEET_MAPA_VENDAS,
} from './constants';
import {
  appendSheetRows,
  deleteSheetRow,
  fetchSheetRange,
  getLastDataRow,
  resolveSheetTitle,
  updateSheetValues,
} from './sheetsClient';
import { appendStatusHistory, diffStatusFields } from './statusHistory';
import { listNfRowNums } from './nfIndexService';

const MONTH_NAMES = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
];

export function normalizeCNPJ(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function normalizeStatusPgto(val: string): string {
  const s = (val ?? '').trim().toUpperCase();
  if (!s) return 'SEM DATA';
  if (s.includes('SEM DATA') || s === '—' || s === '-') return 'SEM DATA';
  if (s.includes('VENCID')) return 'VENCIDA';
  if (s.includes('A VENC') || s.includes('VENCER')) return 'A VENCER';
  if (s.includes('EM DIA') || s.includes('NO PRAZO') || s === 'OK') return 'EM DIA';
  return s;
}

export function defaultOrderDateBR(): string {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function resolveMonthlyTabFromDate(dataBR: string): string {
  const m = dataBR.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return CONSOLIDADO_TAB;
  const month = +m[2];
  const year = +m[3];
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function parseRow(row: string[], rowNum: number): PedidoMapa {
  return {
    rowNum,
    data: row[0] ?? '',
    vendedor: row[1] ?? '',
    cnpj: row[2] ?? '',
    nomeCliente: row[3] ?? '',
    numPedidoCli: row[4] ?? '',
    prioridade: row[5] ?? '',
    descricaoProduto: row[6] ?? '',
    distribuidor: row[7] ?? '',
    numPedidoDist: row[8] ?? '',
    emissao: row[9] ?? '',
    numNF: (row[10] ?? '').trim(),
    parc1: row[11] ?? '',
    parc2: row[12] ?? '',
    parc3: row[13] ?? '',
    parc4: row[14] ?? '',
    statusPgto: normalizeStatusPgto(row[15] ?? ''),
    status: (row[16] ?? '').trim(),
    qtd: row[17] ?? '',
    custoDist: row[18] ?? '',
    totalCompra: row[19] ?? '',
    vendBins: row[20] ?? '',
    vendaTotal: row[21] ?? '',
    vendaPct: row[22] ?? '',
    bruto: row[23] ?? '',
    liquido: row[24] ?? '',
    statusComissao: row[25] ?? '',
    obsPedido: row[26] ?? '',
    obsCliente: row[27] ?? '',
    observacaoCliente: row[28] ?? '',
  };
}

export function pedidoToRow(p: PedidoMapa): string[] {
  return [
    p.data,
    p.vendedor,
    p.cnpj,
    p.nomeCliente,
    p.numPedidoCli,
    p.prioridade,
    p.descricaoProduto,
    p.distribuidor,
    p.numPedidoDist,
    p.emissao,
    p.numNF,
    p.parc1,
    p.parc2,
    p.parc3,
    p.parc4,
    p.statusPgto,
    p.status,
    p.qtd,
    p.custoDist,
    p.totalCompra,
    p.vendBins,
    p.vendaTotal,
    p.vendaPct,
    p.bruto,
    p.liquido,
    p.statusComissao,
    p.obsPedido,
    p.obsCliente,
    p.observacaoCliente ?? '',
  ];
}

function emptyPedido(rowNum: number): PedidoMapa {
  return parseRow(Array(29).fill(''), rowNum);
}

function parseSheetDate(val: string): Date | null {
  if (!val) return null;
  const br = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return new Date(+br[3], +br[2] - 1, +br[1]);
  return null;
}

export function applyPedidosQuery(pedidos: PedidoMapa[], query: PedidosQueryParams): PedidoMapa[] {
  let result = pedidos;

  if (query.status?.trim()) {
    const s = query.status.trim().toUpperCase();
    result = result.filter((p) => p.status.toUpperCase().includes(s));
  }
  if (query.distribuidor?.trim()) {
    const d = query.distribuidor.trim().toLowerCase();
    result = result.filter((p) => p.distribuidor.toLowerCase().includes(d));
  }
  if (query.statusPgto?.trim()) {
    const pg = query.statusPgto.trim().toUpperCase();
    result = result.filter((p) => normalizeStatusPgto(p.statusPgto).includes(pg));
  }
  if (query.search?.trim()) {
    const q = query.search.trim().toLowerCase();
    result = result.filter(
      (p) =>
        p.nomeCliente.toLowerCase().includes(q) ||
        p.cnpj.includes(q) ||
        p.numNF.includes(q) ||
        p.numPedidoCli.includes(q) ||
        p.numPedidoDist.includes(q) ||
        p.descricaoProduto.toLowerCase().includes(q)
    );
  }
  if (query.dateFrom?.trim()) {
    const from = parseSheetDate(query.dateFrom.trim());
    if (from) {
      result = result.filter((p) => {
        const d = parseSheetDate(p.data);
        return d && d >= from;
      });
    }
  }
  if (query.dateTo?.trim()) {
    const to = parseSheetDate(query.dateTo.trim());
    if (to) {
      to.setHours(23, 59, 59, 999);
      result = result.filter((p) => {
        const d = parseSheetDate(p.data);
        return d && d <= to;
      });
    }
  }

  return result;
}

export async function enrichPedidosWithNfFlag(pedidos: PedidoMapa[]): Promise<PedidoMapa[]> {
  const nfRows = await listNfRowNums();
  return pedidos.map((p) => ({ ...p, hasNfFile: nfRows.has(p.rowNum) }));
}

export async function fetchAllOrders(): Promise<PedidoMapa[]> {
  const rows = await fetchSheetRange(
    SPREADSHEET_MAPA_VENDAS,
    `${CONSOLIDADO_TAB}!A2:AC5000`
  );
  return rows
    .map((row, i) => parseRow(row, i + 2))
    .filter((p) => p.nomeCliente.trim() !== '' || p.cnpj.trim() !== '');
}

export function filterOrdersForAuth(auth: AuthContext, pedidos: PedidoMapa[]): PedidoMapa[] {
  if (auth.portalUser.role !== 'cliente') {
    return pedidos;
  }
  if (auth.clientStatus !== 'ativo') {
    return [];
  }
  const set = new Set(auth.portalUser.cnpjs.map(normalizeCNPJ));
  if (set.size === 0) return [];
  return pedidos.filter((p) => set.has(normalizeCNPJ(p.cnpj)));
}

function pedidoRef(p: Pick<PedidoMapa, 'numPedidoCli' | 'numNF'>): string {
  return (p.numPedidoCli || p.numNF || '').trim();
}

export async function createOrder(
  auth: AuthContext,
  partial: Partial<PedidoMapa>
): Promise<PedidoMapa> {
  const data = (partial.data ?? '').trim() || defaultOrderDateBR();
  const nextRow = (await getLastDataRow(SPREADSHEET_MAPA_VENDAS, CONSOLIDADO_TAB)) + 1;
  const pedido: PedidoMapa = {
    ...emptyPedido(nextRow),
    ...partial,
    rowNum: nextRow,
    data,
    statusPgto: normalizeStatusPgto(partial.statusPgto ?? 'SEM DATA'),
  };

  await appendSheetRows(SPREADSHEET_MAPA_VENDAS, CONSOLIDADO_TAB, [pedidoToRow(pedido)]);

  const monthlyTab = resolveMonthlyTabFromDate(data);
  if (monthlyTab !== CONSOLIDADO_TAB) {
    try {
      const tab = await resolveSheetTitle(SPREADSHEET_MAPA_VENDAS, monthlyTab);
      await appendSheetRows(SPREADSHEET_MAPA_VENDAS, tab, [pedidoToRow(pedido)]);
    } catch (err) {
      console.warn('[orders] Espelho aba mensal falhou:', monthlyTab, err);
    }
  }

  if (pedido.status.trim()) {
    await appendStatusHistory(
      diffStatusFields(
        pedido.rowNum,
        pedidoRef(pedido),
        auth.email,
        { status: '', obsCliente: '' },
        { status: pedido.status, obsCliente: pedido.obsCliente }
      )
    );
  }

  return pedido;
}

export async function updateOrder(
  auth: AuthContext,
  rowNum: number,
  updates: Partial<PedidoMapa>
): Promise<PedidoMapa> {
  const all = await fetchAllOrders();
  const existing = all.find((p) => p.rowNum === rowNum);
  if (!existing) throw new Error('Pedido não encontrado.');

  const isClient = auth.portalUser.role === 'cliente';
  if (isClient) {
    const allowed: Partial<PedidoMapa> = {};
    if (updates.observacaoCliente !== undefined) {
      allowed.observacaoCliente = updates.observacaoCliente;
    }
    updates = allowed;
    if (Object.keys(updates).length === 0) {
      throw new Error('Clientes só podem atualizar a observação do pedido.');
    }
  }

  const merged: PedidoMapa = {
    ...existing,
    ...updates,
    rowNum,
    statusPgto: normalizeStatusPgto(updates.statusPgto ?? existing.statusPgto),
  };

  await updateSheetValues(
    SPREADSHEET_MAPA_VENDAS,
    `${CONSOLIDADO_TAB}!A${rowNum}:AC${rowNum}`,
    [pedidoToRow(merged)]
  );

  const history = diffStatusFields(
    rowNum,
    pedidoRef(merged),
    auth.email,
    { status: existing.status, obsCliente: existing.obsCliente },
    { status: merged.status, obsCliente: merged.obsCliente }
  );
  await appendStatusHistory(history);

  return merged;
}

export async function deleteOrder(rowNum: number): Promise<void> {
  const all = await fetchAllOrders();
  if (!all.some((p) => p.rowNum === rowNum)) {
    throw new Error('Pedido não encontrado.');
  }
  await deleteSheetRow(SPREADSHEET_MAPA_VENDAS, CONSOLIDADO_TAB, rowNum);
}

export async function getOrderByRowNum(rowNum: number): Promise<PedidoMapa | null> {
  const rows = await fetchSheetRange(
    SPREADSHEET_MAPA_VENDAS,
    `${CONSOLIDADO_TAB}!A${rowNum}:AC${rowNum}`
  );
  if (!rows[0]) return null;
  return parseRow(rows[0], rowNum);
}
