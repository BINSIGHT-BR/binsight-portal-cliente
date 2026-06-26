import { PedidoMapa } from '../types';
import { formatBRLForSheet, formatPctForSheet, parseBRLnum } from './brl';

/** Colunas T, V, W, X — calculadas a partir de Qtd × unitários (S e U). */
export function computeOrderDerivedFields(
  partial: Pick<PedidoMapa, 'qtd' | 'custoDist' | 'vendBins'>
): Pick<PedidoMapa, 'totalCompra' | 'vendaTotal' | 'vendaPct' | 'bruto'> {
  const q = parseFloat(String(partial.qtd ?? '').replace(',', '.')) || 0;
  const custoUnit = parseBRLnum(partial.custoDist ?? '');
  const vendUnit = parseBRLnum(partial.vendBins ?? '');

  const totalCompra = custoUnit * q;
  const vendaTotal = vendUnit * q;
  const bruto = vendaTotal - totalCompra;
  const pct = totalCompra > 0 ? (bruto / totalCompra) * 100 : 0;

  return {
    totalCompra: q > 0 && custoUnit > 0 ? formatBRLForSheet(totalCompra) : '',
    vendaTotal: q > 0 && vendUnit > 0 ? formatBRLForSheet(vendaTotal) : '',
    bruto: q > 0 && (custoUnit > 0 || vendUnit > 0) ? formatBRLForSheet(bruto) : '',
    vendaPct: q > 0 && totalCompra > 0 ? formatPctForSheet(pct) : '',
  };
}

export function applyDerivedFields(partial: Partial<PedidoMapa>): Partial<PedidoMapa> {
  const derived = computeOrderDerivedFields(partial as PedidoMapa);
  return { ...partial, ...derived };
}
