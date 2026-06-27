export type MapaKind = 'pedido' | 'assinatura';

/** Linha completa do CONSOLIDADO ou aba ASSINATURAS — MAPA VENDAS. */
export interface PedidoMapa {
  /** Origem: CONSOLIDADO/mensal ou aba ASSINATURAS. */
  mapaKind?: MapaKind;
  rowNum: number;
  /** Planilha Mapa de origem (multi-ano). */
  mapaSpreadsheetId?: string;
  /** Ano do pedido (col data ou mapa arquivado). */
  mapaYear?: number;
  /** Aba de origem no Mapa (CONSOLIDADO, Janeiro, …). */
  mapaTab?: string;
  /** A — Data do pedido */
  data: string;
  /** B */
  vendedor: string;
  /** C */
  cnpj: string;
  /** D */
  nomeCliente: string;
  /** E — N° Ped. Cliente (OC) */
  numPedidoCli: string;
  /** F */
  prioridade: string;
  /** G */
  descricaoProduto: string;
  /** H */
  distribuidor: string;
  /** I */
  numPedidoDist: string;
  /** J — NF Emitida? (Sim/Não) */
  emissao: string;
  /** K */
  numNF: string;
  /** L–O — parcelas */
  parc1: string;
  parc2: string;
  parc3: string;
  parc4: string;
  /** P — STATUS PGTO */
  statusPgto: string;
  /** Q — STATUS pedido */
  status: string;
  /** R */
  qtd: string;
  /** S–Y — valores comerciais */
  custoDist: string;
  totalCompra: string;
  vendBins: string;
  vendaTotal: string;
  vendaPct: string;
  bruto: string;
  liquido: string;
  /** Z */
  statusComissao: string;
  /** AA — obs interna */
  obsPedido: string;
  /** AB — obs visível ao cliente */
  obsCliente: string;
  /** AC — link Google Drive NF */
  nfDriveUrl: string;
  /** AD — link Google Drive boleto */
  boletoDriveUrl: string;
  /** Campo livre (não usado no Mapa atual). */
  observacaoCliente?: string;
  /** NF disponível para download (API legado) */
  hasNfFile?: boolean;
  /** ASSINATURAS col E — ex.: Assinatura de Licença */
  tipoRecorrencia?: string;
  /** ASSINATURAS col F */
  statusContrato?: string;
  /** ASSINATURAS col G */
  periodicidade?: string;
  /** ASSINATURAS col M — N° contrato distribuidor */
  numContratoDist?: string;
  /** ASSINATURAS col N — vencimento da recorrência */
  vencimento?: string;
}

/** @deprecated Use PedidoMapa — alias mantido para compatibilidade interna. */
export type PedidoVenda = PedidoMapa;

/** Visão sanitizada exibida ao cliente (sem margens, vendedor, comissão). */
export interface PedidoCliente {
  id: string;
  data: string;
  numPedidoCli: string;
  descricaoProduto: string;
  qtd: string;
  vendaTotal: string;
  status: string;
  statusPgto: string;
  /** Usado só para derivar label (col Z — não exibido ao cliente). */
  statusComissao?: string;
  emissao: string;
  numNF: string;
  obsCliente: string;
  observacaoCliente: string;
  /** Distribuidor do pedido (visível ao cliente). */
  distribuidor: string;
  /** Vendedor BInsight que atendeu (visível ao cliente). */
  vendedor: string;
  /** Aba de origem no Mapa (CONSOLIDADO, Janeiro, …). */
  mapaTab?: string;
  nfDriveUrl?: string;
  boletoDriveUrl?: string;
  hasNfFile?: boolean;
  rowNum?: number;
  mapaSpreadsheetId?: string;
  mapaYear?: number;
  mapaKind?: MapaKind;
  tipoRecorrencia?: string;
  statusContrato?: string;
  periodicidade?: string;
  vencimento?: string;
  parc1?: string;
  parc2?: string;
  parc3?: string;
  parc4?: string;
  tipoProduto?: TipoProdutoPedido;
}

export type TipoProdutoPedido = 'hardware' | 'software';

export type PortalRole = 'admin' | 'financeiro' | 'staff' | 'cliente';

export interface PortalUser {
  email: string;
  displayName: string;
  role: PortalRole;
  /** CNPJs liberados (só para role cliente). */
  cnpjs: string[];
  /** Preferência de e-mail (col H registry). */
  notifyEmail?: boolean;
}

/** Registro na aba CLIENT_PORTAL_REGISTRY / CLIENT_ACCESS. */
export interface ClientPortalUser {
  email: string;
  nome: string;
  cnpj: string;
  status: ClientAccessStatus;
  approvedBy: string;
  approvedAt: string;
  additionalCnpjs: string[];
  /** Col H — Sim/Não: receber e-mails de status, NF e boleto */
  notifyEmail: boolean;
}

/** @deprecated Use ClientPortalUser */
export interface ClientAccessRecord {
  email: string;
  /** Col B — empresa ou nome de exibição no portal */
  nome: string;
  cnpj: string;
  status: ClientAccessStatus;
  aprovadoPor: string;
  dataAprovacao: string;
  cnpjsAdicionais: string[];
  notifyEmail: boolean;
  /** Col I — nome do contato */
  nomeContato?: string;
  /** Col J — sobrenome do contato */
  sobrenomeContato?: string;
  /** Cadastro criado via Firebase (ainda não na planilha) */
  firestoreUid?: string;
}

export type ClientAccessStatus = 'PENDENTE' | 'ATIVO' | 'REVOGADO';

export interface ConsolidadoColumnDef {
  key: keyof PedidoMapa;
  colIndex: number;
  label: string;
  financeEditable: boolean;
  adminOnly?: boolean;
  clientVisible?: boolean;
  type?: 'text' | 'select' | 'textarea' | 'date';
  options?: string[];
}

export type TimelineStageId =
  | 'confirmado'
  | 'credito'
  | 'faturado'
  | 'rota'
  | 'entregue'
  | 'licenca';

export interface TimelineStage {
  id: TimelineStageId;
  label: string;
  description?: string;
}

export type AlertKind = 'pagamento_vencido' | 'pagamento_a_vencer' | 'nf_pendente';

export interface OrderAlert {
  kind: AlertKind;
  pedido: PedidoMapa;
  message: string;
  severity: 'warning' | 'critical';
}
