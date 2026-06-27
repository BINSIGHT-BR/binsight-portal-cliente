import { useState } from 'react';
import { PedidoMapa, PortalUser } from '../types';
import { fmtBRL } from '../utils/orders';
import { formatPctDisplay } from '../utils/brl';
import { pedidoRefBadge } from '../utils/orderFilters';
import { canEditOrders, seesFinancialDetails } from '../utils/roles';
import { ChevronDown, ChevronUp, Package, Pencil, Trash2 } from 'lucide-react';

import { orderDomId } from '../utils/driveDocumentView';

interface Props {
  pedido: PedidoMapa;
  user: PortalUser;
  accessToken?: string;
  highlighted?: boolean;
  onEdit?: (pedido: PedidoMapa) => void;
  onDelete?: (pedido: PedidoMapa) => void;
}

function StatusBadge({ label }: { label: string }) {
  const l = label.toUpperCase();
  let cls = 'bg-slate-100 text-slate-600';
  if (l === 'VENCIDA') cls = 'bg-red-100 text-red-700';
  else if (l === 'A VENCER') cls = 'bg-orange-100 text-orange-700';
  else if (l === 'EM DIA') cls = 'bg-green-100 text-green-700';
  else if (l === 'SEM DATA') cls = 'bg-slate-100 text-slate-500';
  else if (l === 'FATURADO') cls = 'bg-blue-100 text-blue-700';
  else if (l === 'FINALIZADO' || l === 'ENTREGUE') cls = 'bg-green-100 text-green-700';
  else if (l === 'PENDENTE') cls = 'bg-yellow-100 text-yellow-700';
  else if (l === 'CANCELADO') cls = 'bg-red-100 text-red-700';
  else if (l.includes('SOLICITADO') || l.includes('TRANSITO')) cls = 'bg-indigo-100 text-indigo-700';
  if (!label) return null;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

export default function OrderCard({ pedido: p, user, onEdit, onDelete, highlighted }: Props) {
  const [open, setOpen] = useState(false);
  const showFinance = seesFinancialDetails(user);
  const editable = canEditOrders(user) && onEdit;
  const pedidoRef = pedidoRefBadge(p);

  return (
    <div
      id={orderDomId(p.rowNum, p.mapaKind)}
      className={`bg-white border rounded-xl shadow-sm overflow-hidden transition-shadow ${
        highlighted ? 'border-purple-500 ring-2 ring-purple-200 shadow-md' : 'border-slate-200'
      }`}
    >
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono text-slate-400">{p.data || '—'}</span>
            {p.mapaYear && (
              <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                {p.mapaYear}
              </span>
            )}
            {p.numNF && (
              <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                NF {p.numNF}
              </span>
            )}
            {pedidoRef && (
              <span className="text-[10px] font-mono bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">
                {pedidoRef.kind} {pedidoRef.value}
              </span>
            )}
            {p.mapaKind === 'assinatura' && (
              <span className="text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">
                Assinatura
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-bold text-slate-800 truncate">{p.nomeCliente || '—'}</p>
          <p className="text-[11px] text-slate-400 font-mono">{p.cnpj}</p>
        </div>
        <div className="flex items-center gap-1">
          {editable && (
            <button
              onClick={() => onEdit!(p)}
              className="p-1.5 rounded-lg hover:bg-purple-50 text-purple-600 transition"
              title="Editar pedido"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(p)}
              className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition"
              title="Excluir pedido"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setOpen((o) => !o)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition"
          >
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="px-4 pb-3 flex items-start gap-2">
        <Package className="w-3.5 h-3.5 text-slate-300 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-500 leading-tight">{p.descricaoProduto || '—'}</p>
      </div>

      <div className="px-4 pb-3 flex flex-wrap gap-1.5">
        <StatusBadge label={p.status} />
        <StatusBadge label={p.statusPgto} />
        {showFinance && p.statusComissao && <StatusBadge label={p.statusComissao} />}
      </div>

      <div className="px-4 pb-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[9px] uppercase font-bold text-slate-400">Valor</p>
          <p className="text-xs font-bold text-slate-700">{fmtBRL(p.vendaTotal)}</p>
        </div>
        {p.distribuidor && (
          <div>
            <p className="text-[9px] uppercase font-bold text-slate-400">Distribuidor</p>
            <p className="text-xs font-semibold text-slate-600 truncate">{p.distribuidor}</p>
          </div>
        )}
      </div>

      {open && (
        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/60 space-y-2 text-[11px]">
          <Row label="Qtd" value={p.qtd} />
          <Row label="Emissão NF" value={p.emissao} />
          {p.mapaKind === 'assinatura' ? (
            <>
              <Row label="Recorrência" value={p.tipoRecorrencia ?? ''} />
              <Row label="Contrato" value={p.statusContrato ?? ''} />
              <Row label="Periodicidade" value={p.periodicidade ?? ''} />
              <Row label="Vencimento" value={p.vencimento ?? p.parc1} />
            </>
          ) : (
            <>
              <Row label="1ª Parc." value={p.parc1} />
              {p.parc2 && <Row label="2ª Parc." value={p.parc2} />}
              {p.parc3 && <Row label="3ª Parc." value={p.parc3} />}
              {p.parc4 && <Row label="4ª Parc." value={p.parc4} />}
            </>
          )}
          {showFinance && (
            <>
              <Row
                label="Margem %"
                value={formatPctDisplay(p.vendaPct, {
                  bruto: p.bruto,
                  totalCompra: p.totalCompra,
                  vendaTotal: p.vendaTotal,
                })}
              />
              <Row label="Bruto" value={fmtBRL(p.bruto)} />
              <Row label="Líquido" value={fmtBRL(p.liquido)} />
              <Row label="Vendedor" value={p.vendedor} />
            </>
          )}
          {p.obsCliente && (
            <div className="pt-2">
              <p className="text-[9px] font-bold uppercase text-slate-400 mb-1">Obs. Cliente (AB)</p>
              <p className="text-slate-600">{p.obsCliente}</p>
            </div>
          )}
          {p.obsPedido && showFinance && (
            <div className="pt-2">
              <p className="text-[9px] font-bold uppercase text-slate-400 mb-1">Obs. interna</p>
              <p className="text-slate-600 whitespace-pre-line">{p.obsPedido}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-slate-400">{label}: </span>
      <span className="text-slate-700 font-semibold">{value}</span>
    </div>
  );
}
