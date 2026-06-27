import { PedidoMapa, PedidoCliente, TipoProdutoPedido } from '../types';

const SOFTWARE_KEYWORDS = [
  'licença', 'licenca', 'license', 'software', 'subscription', 'assinatura',
  'saas', 'cloud', 'microsoft 365', 'office 365', 'adobe', 'autodesk',
];

export function inferTipoProduto(descricao: string): TipoProdutoPedido {
  const d = descricao.toLowerCase();
  return SOFTWARE_KEYWORDS.some((k) => d.includes(k)) ? 'software' : 'hardware';
}

export function sanitizePedidoForClient(p: PedidoMapa): PedidoCliente {
  const ref = p.numPedidoCli.trim() || p.numNF.trim() || `row-${p.rowNum}`;
  const kind = p.mapaKind ?? 'pedido';
  const tabKey = p.mapaTab?.trim() || 'CONSOLIDADO';
  const id = p.mapaSpreadsheetId
    ? `${p.mapaSpreadsheetId}-${tabKey}-${kind}-${p.rowNum}`
    : `${tabKey}-${kind}-${ref}`;
  return {
    id,
    rowNum: p.rowNum,
    mapaSpreadsheetId: p.mapaSpreadsheetId,
    mapaYear: p.mapaYear ?? undefined,
    mapaTab: p.mapaTab,
    data: p.data,
    numPedidoCli: p.numPedidoCli,
    descricaoProduto: p.descricaoProduto,
    qtd: p.qtd,
    vendaTotal: p.vendaTotal,
    status: p.status,
    statusComissao: p.statusComissao,
    statusPgto: p.statusPgto,
    emissao: p.emissao,
    numNF: p.numNF,
    obsCliente: p.obsCliente,
    distribuidor: p.distribuidor,
    vendedor: p.vendedor,
    nfDriveUrl: p.nfDriveUrl,
    boletoDriveUrl: p.boletoDriveUrl,
    observacaoCliente: p.observacaoCliente ?? '',
    mapaKind: p.mapaKind,
    tipoRecorrencia: p.tipoRecorrencia,
    statusContrato: p.statusContrato,
    periodicidade: p.periodicidade,
    vencimento: p.vencimento ?? p.parc1,
    parc1: p.parc1,
    parc2: p.parc2,
    parc3: p.parc3,
    parc4: p.parc4,
    tipoProduto:
      p.mapaKind === 'assinatura' ? 'software' : inferTipoProduto(p.descricaoProduto),
    hasNfFile: p.hasNfFile,
  };
}

export function sanitizePedidosForClient(pedidos: PedidoMapa[]): PedidoCliente[] {
  return pedidos.map(sanitizePedidoForClient);
}
