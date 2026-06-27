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
  listSheetTitles,
  resolveSheetTitle,
  updateSheetValues,
} from './sheetsClient';
import { appendStatusHistory, diffStatusFields } from './statusHistory';
import { listNfRowNums } from './nfIndexService';
import { maybeNotifyPedidoChanges } from './pedidoNotify';

const MONTH_NAMES = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
];

export function normalizeCNPJ(raw: string): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length < 14) return digits.padStart(14, '0');
  if (digits.length > 14) return digits.slice(-14);
  return digits;
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

const ASSINATURAS_TAB = 'ASSINATURAS';

const SKIP_ORDER_TABS = new Set([
  'DISTRIBUIDORES',
  'VENDEDORES',
  'COMISSÕES REPRESENTANTES',
  'Cotacoes Distribuidores',
]);

const MONTH_TAB_PREFIXES = [
  'janeiro',
  'fevereiro',
  'marco',
  'março',
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

function normalizeTabName(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function isMonthlyTab(title: string): boolean {
  const norm = normalizeTabName(title);
  return MONTH_TAB_PREFIXES.some((m) => norm === m || norm.startsWith(`${m} `));
}

function isMeaningfulOrderRow(p: Pick<PedidoMapa, 'nomeCliente' | 'cnpj' | 'numPedidoCli' | 'numPedidoDist'>): boolean {
  return (
    p.nomeCliente.trim() !== '' ||
    p.cnpj.trim() !== '' ||
    p.numPedidoCli.trim() !== '' ||
    p.numPedidoDist.trim() !== ''
  );
}

function parseAssinaturaRow(row: string[], rowNum: number): PedidoMapa {
  const vencimento = row[13] ?? '';
  return {
    rowNum,
    mapaTab: ASSINATURAS_TAB,
    data: row[0] ?? '',
    vendedor: row[1] ?? '',
    cnpj: normalizeCNPJ(row[2] ?? ''),
    nomeCliente: row[3] ?? '',
    numPedidoCli: row[7] ?? '',
    prioridade: '',
    descricaoProduto: row[11] ?? '',
    distribuidor: row[8] ?? '',
    numPedidoDist: '',
    emissao: row[9] ?? '',
    numNF: (row[10] ?? '').trim(),
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
    observacaoCliente: '',
    nfDriveUrl: '',
    boletoDriveUrl: '',
  };
}

function parseRow(row: string[], rowNum: number, mapaTab = CONSOLIDADO_TAB): PedidoMapa {
  return {
    rowNum,
    mapaTab,
    data: row[0] ?? '',
    vendedor: row[1] ?? '',
    cnpj: normalizeCNPJ(row[2] ?? ''),
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
    observacaoCliente: '',
    nfDriveUrl: row[28] ?? '',
    boletoDriveUrl: row[29] ?? '',
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
    p.nfDriveUrl ?? '',
    p.boletoDriveUrl ?? '',
  ];
}

function emptyPedido(rowNum: number): PedidoMapa {
  return parseRow(Array(30).fill(''), rowNum);
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
    result = result.filter((p) => {
      const comissaoPaga = (p.statusComissao ?? '').trim().toUpperCase();
      if (pg.includes('VENCID') && (comissaoPaga === 'PAGA' || comissaoPaga.includes('PAGA'))) {
        return false;
      }
      return normalizeStatusPgto(p.statusPgto).includes(pg);
    });
  }
  if (query.search?.trim()) {
    const norm = (s: string) => s.trim().toLowerCase().replace(/[\s\-./_]/g, '');
    const qRaw = norm(query.search);
    const variants = new Set([qRaw]);
    if (qRaw.startsWith('bin')) variants.add(qRaw.slice(3));
    result = result.filter((p) => {
      const blob = norm(
        [
          p.nomeCliente,
          p.cnpj,
          p.numNF,
          p.numPedidoCli,
          p.numPedidoDist,
          p.descricaoProduto,
          p.distribuidor,
          p.vendedor,
        ].join(' ')
      );
      return [...variants].some((v) => v && blob.includes(v));
    });
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

async function fetchOrdersFromTab(tab: string): Promise<PedidoMapa[]> {
  const range =
    tab === ASSINATURAS_TAB ? `${tab}!A2:X5000` : `${tab}!A2:AD5000`;
  const rows = await fetchSheetRange(SPREADSHEET_MAPA_VENDAS, range);
  return rows
    .map((row, i) =>
      tab === ASSINATURAS_TAB
        ? parseAssinaturaRow(row, i + 2)
        : parseRow(row, i + 2, tab)
    )
    .filter(isMeaningfulOrderRow);
}

export async function fetchAllOrders(): Promise<PedidoMapa[]> {
  const consolidado = await fetchOrdersFromTab(CONSOLIDADO_TAB);

  // CONSOLIDADO preenchido → fonte única (evita duplicata e rowNum errado entre abas).
  if (consolidado.length > 0) {
    consolidado.sort((a, b) => {
      const da = parseSheetDate(a.data)?.getTime() ?? 0;
      const db = parseSheetDate(b.data)?.getTime() ?? 0;
      return db - da;
    });
    return consolidado;
  }

  const all: PedidoMapa[] = [];

  const titles = await listSheetTitles(SPREADSHEET_MAPA_VENDAS);
  for (const title of titles) {
    if (title === CONSOLIDADO_TAB || title === ASSINATURAS_TAB) continue;
    if (SKIP_ORDER_TABS.has(title)) continue;
    if (!isMonthlyTab(title)) continue;
    try {
      all.push(...(await fetchOrdersFromTab(title)));
    } catch (err) {
      console.warn('[orders] Falha ao ler aba mensal:', title, err);
    }
  }

  try {
    all.push(...(await fetchOrdersFromTab(ASSINATURAS_TAB)));
  } catch (err) {
    console.warn('[orders] Falha ao ler ASSINATURAS:', err);
  }

  all.sort((a, b) => {
    const da = parseSheetDate(a.data)?.getTime() ?? 0;
    const db = parseSheetDate(b.data)?.getTime() ?? 0;
    return db - da;
  });

  return all;
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
    `${CONSOLIDADO_TAB}!A${rowNum}:AD${rowNum}`,
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

  if (!isClient) {
    void maybeNotifyPedidoChanges(existing, merged).catch((err) => {
      console.warn('[orders] Falha ao notificar cliente:', err);
    });
  }

  return merged;
}

export async function deleteOrder(rowNum: number): Promise<void> {
  const all = await fetchAllOrders();
  if (!all.some((p) => p.rowNum === rowNum)) {
    throw new Error('Pedido não encontrado.');
  }
  await deleteSheetRow(SPREADSHEET_MAPA_VENDAS, CONSOLIDADO_TAB, rowNum);
}

export async function getOrderByRowNum(rowNum: number, mapaTab?: string): Promise<PedidoMapa | null> {
  if (mapaTab) {
    const colEnd = mapaTab === ASSINATURAS_TAB ? 'X' : 'AD';
    const rows = await fetchSheetRange(
      SPREADSHEET_MAPA_VENDAS,
      `${mapaTab}!A${rowNum}:${colEnd}${rowNum}`
    );
    if (!rows[0]) return null;
    return mapaTab === ASSINATURAS_TAB
      ? parseAssinaturaRow(rows[0], rowNum)
      : parseRow(rows[0], rowNum, mapaTab);
  }

  const tabsToTry = mapaTab
    ? [mapaTab]
    : [CONSOLIDADO_TAB, ...(await listSheetTitles(SPREADSHEET_MAPA_VENDAS)).filter(isMonthlyTab), ASSINATURAS_TAB];
  for (const tab of tabsToTry) {
    const pedido = await getOrderByRowNum(rowNum, tab);
    if (pedido && isMeaningfulOrderRow(pedido)) return pedido;
  }
  return null;
}

export async function fetchOrderRowFromSpreadsheet(
  spreadsheetId: string,
  sheetName: string,
  rowNum: number
): Promise<PedidoMapa | null> {
  const colEnd = sheetName === ASSINATURAS_TAB ? 'X' : 'AD';
  const rows = await fetchSheetRange(
    spreadsheetId,
    `${sheetName}!A${rowNum}:${colEnd}${rowNum}`
  );
  if (!rows[0]) return null;
  return sheetName === ASSINATURAS_TAB
    ? parseAssinaturaRow(rows[0], rowNum)
    : parseRow(rows[0], rowNum, sheetName);
}
