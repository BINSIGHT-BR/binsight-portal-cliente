import { ConsolidadoColumnDef } from '../types';
import { OBS_CLIENTE_STATUSES } from './obsCliente';

/** Definição das colunas A–AB do CONSOLIDADO (gid 809888450). */
export const CONSOLIDADO_COLUMNS: ConsolidadoColumnDef[] = [
  { key: 'data', colIndex: 0, label: 'Data', financeEditable: true, type: 'date' },
  { key: 'vendedor', colIndex: 1, label: 'Vendedor', financeEditable: false, adminOnly: true },
  { key: 'cnpj', colIndex: 2, label: 'CNPJ', financeEditable: true },
  { key: 'nomeCliente', colIndex: 3, label: 'Nome do Cliente', financeEditable: true },
  { key: 'numPedidoCli', colIndex: 4, label: 'N° Ped. Cliente (OC)', financeEditable: true, clientVisible: true },
  {
    key: 'prioridade',
    colIndex: 5,
    label: 'Prioridade',
    financeEditable: true,
    type: 'select',
    options: ['Baixa', 'Média', 'Alta', 'Urgente'],
  },
  { key: 'descricaoProduto', colIndex: 6, label: 'Descrição do Produto', financeEditable: true, clientVisible: true },
  { key: 'distribuidor', colIndex: 7, label: 'Distribuidor', financeEditable: true },
  { key: 'numPedidoDist', colIndex: 8, label: 'N° Ped. Distribuidor', financeEditable: true },
  {
    key: 'emissao',
    colIndex: 9,
    label: 'NF Emitida?',
    financeEditable: true,
    clientVisible: true,
    type: 'select',
    options: ['Sim', 'Não', '✔', '✖'],
  },
  { key: 'numNF', colIndex: 10, label: 'N° NF', financeEditable: true, clientVisible: true },
  { key: 'parc1', colIndex: 11, label: '1ª Parc. vencimento', financeEditable: true, type: 'date' },
  { key: 'parc2', colIndex: 12, label: '2ª Parc. vencimento', financeEditable: true, type: 'date' },
  { key: 'parc3', colIndex: 13, label: '3ª Parc. vencimento', financeEditable: true, type: 'date' },
  { key: 'parc4', colIndex: 14, label: '4ª Parc. vencimento', financeEditable: true, type: 'date' },
  {
    key: 'statusPgto',
    colIndex: 15,
    label: 'Status Pagamento',
    financeEditable: true,
    type: 'select',
    options: ['EM DIA', 'A VENCER', 'VENCIDA', 'SEM DATA', 'PAGA'],
  },
  {
    key: 'status',
    colIndex: 16,
    label: 'Status Pedido',
    financeEditable: true,
    clientVisible: true,
    type: 'select',
    options: ['PENDENTE', 'SOLICITADO', 'FATURADO', 'FINALIZADO', 'CANCELADO', 'EM TRANSITO', 'ENTREGUE'],
  },
  { key: 'qtd', colIndex: 17, label: 'Qtd', financeEditable: true, clientVisible: true },
  { key: 'custoDist', colIndex: 18, label: 'R$ Custo Dist.', financeEditable: true, adminOnly: true },
  { key: 'totalCompra', colIndex: 19, label: 'Total Compra', financeEditable: true, adminOnly: true },
  { key: 'vendBins', colIndex: 20, label: 'R$ Vend. BInsight', financeEditable: true, adminOnly: true },
  { key: 'vendaTotal', colIndex: 21, label: 'Venda Total', financeEditable: true, clientVisible: true, adminOnly: true },
  { key: 'vendaPct', colIndex: 22, label: 'Venda %', financeEditable: true, adminOnly: true },
  { key: 'bruto', colIndex: 23, label: 'Bruto', financeEditable: true, adminOnly: true },
  { key: 'liquido', colIndex: 24, label: 'Líquido', financeEditable: true, adminOnly: true },
  {
    key: 'statusComissao',
    colIndex: 25,
    label: 'Status Comissão',
    financeEditable: false,
    adminOnly: true,
    type: 'select',
    options: ['PENDENTE', 'SOLICITADO', 'FINALIZADO', 'PAGA'],
  },
  { key: 'obsPedido', colIndex: 26, label: 'Obs. Pedido (interna)', financeEditable: true, type: 'textarea' },
  {
    key: 'obsCliente',
    colIndex: 27,
    label: 'Obs. Cliente (col AB)',
    financeEditable: true,
    clientVisible: true,
    type: 'select',
    options: [...OBS_CLIENTE_STATUSES],
  },
  {
    key: 'nfDriveUrl',
    colIndex: 28,
    label: 'Link NF (col AC)',
    financeEditable: true,
    clientVisible: true,
  },
  {
    key: 'boletoDriveUrl',
    colIndex: 29,
    label: 'Link Boleto (col AD)',
    financeEditable: true,
    clientVisible: true,
  },
];

/** Mapa Vendas 2026 — fallback quando VITE_MAPA_SPREADSHEET_ID não está definido. */
export const SPREADSHEET_MAPA_VENDAS = '1xLp12EAjknPVJWJPNivvPfe5BQhut6jMeYr8qHJ7foI';

/** Cadastro de clientes BInsight (lookup CNPJ → nome). */
export const SPREADSHEET_BINSIGHT_CUSTOMERS =
  (import.meta.env.VITE_CUSTOMERS_SPREADSHEET_ID as string | undefined)?.trim() ||
  '1QvEBu0v9E3ijasS3gWY-0_5GxyR6U__FnGGy_yx20gM';

/** Master distribuidores — col D = NOME FANTASIA (col H do Mapa). */
export const SPREADSHEET_MASTER_DISTRIBUIDORES =
  (import.meta.env.VITE_MASTER_DISTRIBUIDORES_ID as string | undefined)?.trim() ||
  '1wobdobBKv-R1QrdKuYJLl0KBbQD1jOaKWyz-B42VVa4';

/** Planilha permanente BInsight Connect — Registry. */
export const SPREADSHEET_CLIENT_REGISTRY_DEFAULT =
  '1zifdxkwq3rYlACtKtcmuXUWtbu6X4Aq0YC-3pBRbva8';

export const CONSOLIDADO_TAB = 'CONSOLIDADO';
export const CONSOLIDADO_GID = 809888450;
export const ASSINATURAS_TAB = 'ASSINATURAS';
export const ASSINATURAS_COL_COUNT = 24;
export const ASSINATURAS_RANGE = 'A2:X5000';

export const TIPO_RECORRENCIA_OPTIONS = ['Assinatura de Licença'] as const;
export const STATUS_CONTRATO_OPTIONS = ['Ativo', 'Suspenso', 'Cancelado', 'Encerrado'] as const;
export const PERIODICIDADE_OPTIONS = ['Mensal', 'Anual', 'Trimestral', 'Semestral'] as const;
export const CLIENT_PORTAL_REGISTRY_TAB = 'CLIENT_PORTAL_REGISTRY';
export const CLIENT_ACCESS_TAB = 'CLIENT_ACCESS';

/** Colunas A–AD (30 cols). */
export const CONSOLIDADO_COL_COUNT = 30;
export const CONSOLIDADO_RANGE = `A2:AD5000`;

export const SPREADSHEET_CLIENT_REGISTRY =
  (import.meta.env.VITE_CLIENT_REGISTRY_ID as string | undefined)?.trim() ??
  SPREADSHEET_CLIENT_REGISTRY_DEFAULT;

/** Planilha permanente de acesso — nunca no mapa anual. */
export function getRegistrySpreadsheetId(): string {
  return SPREADSHEET_CLIENT_REGISTRY;
}

/** Mapa corrente (pedidos novos / edição financeiro). */
export function getMapaSpreadsheetId(): string {
  const fromEnv = (import.meta.env.VITE_MAPA_SPREADSHEET_ID as string | undefined)?.trim();
  return fromEnv || SPREADSHEET_MAPA_VENDAS;
}

/** Mapas arquivados — somente leitura para clientes (virada de ano). */
export function getMapaArchiveIds(): string[] {
  const raw = (import.meta.env.VITE_MAPA_ARCHIVE_IDS as string | undefined)?.trim() ?? '';
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

/** Todos os mapas visíveis ao cliente: arquivo + corrente. */
export function getAllMapaIdsForClientRead(): string[] {
  const archives = getMapaArchiveIds();
  const current = getMapaSpreadsheetId();
  if (archives.includes(current)) return archives;
  return [...archives, current];
}

export const USE_MOCK_DATA =
  import.meta.env.VITE_USE_MOCK_DATA === 'true' ||
  import.meta.env.VITE_USE_MOCK_DATA === '1';

/** Produção sem Blaze: OAuth + Sheets API direto (igual portal comercial). */
export const USE_OAUTH_SHEETS = !USE_MOCK_DATA;

/** Local sem login Google — ativo por padrão quando mock data está ligado. */
export const SKIP_AUTH =
  USE_MOCK_DATA &&
  import.meta.env.VITE_SKIP_AUTH !== 'false' &&
  import.meta.env.VITE_SKIP_AUTH !== '0';

export type LocalDemoRole = 'admin' | 'financeiro' | 'cliente';

export function localDemoRole(): LocalDemoRole {
  const raw = (import.meta.env.VITE_LOCAL_DEMO_ROLE as string | undefined)?.trim().toLowerCase();
  if (raw === 'financeiro' || raw === 'cliente' || raw === 'admin') return raw;
  return 'admin';
}

/** Data padrão ao incluir pedido: hoje (dd/mm/aaaa). */
export function defaultOrderDateBR(): string {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/** Nomes reais das abas mensais no Mapa Vendas (igual PortalSync.gs). */
export const MONTH_TAB_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho ',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

/** Junho tem variante com/sem espaço final na planilha. */
export const JUNE_TAB_CANDIDATES = ['Junho ', 'Junho'] as const;

/**
 * A col A (data) determina a aba mensal de destino.
 * Retorna nome base — use resolveMonthlySheetTitle() para o título exato na planilha.
 */
export function resolveMonthlyTabFromDate(dataBR: string): string {
  const m = dataBR.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return CONSOLIDADO_TAB;
  const month = +m[2];
  if (month < 1 || month > 12) return CONSOLIDADO_TAB;
  return MONTH_TAB_NAMES[month - 1];
}

/** Extrai o ano de uma data dd/mm/aaaa. */
export function yearFromDateBR(dataBR: string): number | null {
  const m = dataBR.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? +m[3] : null;
}
