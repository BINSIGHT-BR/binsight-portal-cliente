export const BINSIGHT_EMAIL_DOMAIN = 'binsight.com.br';

export const FERNANDO_EMAIL = 'fernando.dantas@binsight.com.br';
export const FINANCEIRO_EMAIL = 'financeiro@binsight.com.br';

export const SPREADSHEET_MAPA_VENDAS = '1xLp12EAjknPVJWJPNivvPfe5BQhut6jMeYr8qHJ7foI';
export const SPREADSHEET_CLIENT_REGISTRY_DEFAULT =
  '1zifdxkwq3rYlACtKtcmuXUWtbu6X4Aq0YC-3pBRbva8';
export const CONSOLIDADO_TAB = 'CONSOLIDADO';
export const CLIENT_PORTAL_REGISTRY_TAB = 'CLIENT_PORTAL_REGISTRY';
export const CLIENT_ACCESS_TAB = 'CLIENT_ACCESS';
export const STATUS_HISTORY_TAB = 'STATUS_HISTORY';
export const NF_INDEX_TAB = 'NF_INDEX';

/** Planilha do registro de clientes — env CLIENT_REGISTRY_ID ou padrão permanente. */
export function getRegistrySpreadsheetId(): string {
  return (process.env.CLIENT_REGISTRY_ID ?? '').trim() || SPREADSHEET_CLIENT_REGISTRY_DEFAULT;
}

export type PortalRole = 'admin' | 'financeiro' | 'staff' | 'cliente';
export type ClientAccessStatus = 'PENDENTE' | 'ATIVO' | 'REVOGADO';

export interface PortalUser {
  email: string;
  displayName: string;
  role: PortalRole;
  cnpjs: string[];
}

export interface ClientPortalRecord {
  email: string;
  nome: string;
  cnpj: string;
  status: ClientAccessStatus;
  approvedBy: string;
  approvedAt: string;
  additionalCnpjs: string[];
  notifyEmail: boolean;
  /** Col I — nome do contato */
  nomeContato?: string;
  /** Col J — sobrenome do contato */
  sobrenomeContato?: string;
  rowNum: number;
}

export interface NotifyRecipient {
  email: string;
  displayName: string;
}

export interface PedidoMapa {
  rowNum: number;
  data: string;
  vendedor: string;
  cnpj: string;
  nomeCliente: string;
  numPedidoCli: string;
  prioridade: string;
  descricaoProduto: string;
  distribuidor: string;
  numPedidoDist: string;
  emissao: string;
  numNF: string;
  parc1: string;
  parc2: string;
  parc3: string;
  parc4: string;
  statusPgto: string;
  status: string;
  qtd: string;
  custoDist: string;
  totalCompra: string;
  vendBins: string;
  vendaTotal: string;
  vendaPct: string;
  bruto: string;
  liquido: string;
  statusComissao: string;
  obsPedido: string;
  obsCliente: string;
  observacaoCliente: string;
  nfDriveUrl: string;
  boletoDriveUrl: string;
  /** Aba de origem no Mapa (CONSOLIDADO, Janeiro, …). */
  mapaTab?: string;
  /** Indica NF disponível para download (enriquecido pela API) */
  hasNfFile?: boolean;
}

export interface PedidosQueryParams {
  status?: string;
  distribuidor?: string;
  statusPgto?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface AuthContext {
  uid: string;
  email: string;
  portalUser: PortalUser;
  clientStatus: 'none' | 'pendente' | 'ativo' | 'revogado';
}
