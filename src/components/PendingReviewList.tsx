import { useState } from 'react';
import { Check, CheckCircle2, Circle, Loader2, MessageSquarePlus, Pencil, Undo2 } from 'lucide-react';
import { PedidoMapa, PortalUser } from '../types';
import { markPedidoReviewed, unmarkPedidoReviewed, type PedidoDailyReview } from '../utils/pedidoDailyReview';
import { buildPedidoReviewKey } from '../utils/pedidoReviewQueue';
import { pedidoRefBadge } from '../utils/orderFilters';
import { appendObsPedido } from '../utils/obsPedidoAppend';
import OrderEditModal from './OrderEditModal';
import { updateOrderRow, formatCNPJ } from '../utils/orders';

interface Props {
  pedidos: PedidoMapa[];
  user: PortalUser;
  accessToken: string;
  reviewMap: Map<string, PedidoDailyReview>;
  onRefreshOrders: () => void;
  showReviewed?: boolean;
}

export default function PendingReviewList({
  pedidos,
  user,
  accessToken,
  reviewMap,
  onRefreshOrders,
  showReviewed = true,
}: Props) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [editPedido, setEditPedido] = useState<PedidoMapa | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [obsDraft, setObsDraft] = useState<Record<string, string>>({});
  const [obsExpanded, setObsExpanded] = useState<Record<string, boolean>>({});

  const pending = pedidos.filter((p) => !reviewMap.has(buildPedidoReviewKey(p)));
  const done = pedidos.filter((p) => reviewMap.has(buildPedidoReviewKey(p)));
  const list = showReviewed ? [...pending, ...done] : pending;

  const toggleReview = async (pedido: PedidoMapa, checked: boolean) => {
    const key = buildPedidoReviewKey(pedido);
    setBusyKey(key);
    setActionError(null);
    try {
      if (checked) {
        await markPedidoReviewed(pedido, { email: user.email, displayName: user.displayName });
      } else {
        await unmarkPedidoReviewed(pedido);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao salvar revisão.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleSave = async (pedido: PedidoMapa) => {
    await updateOrderRow(accessToken, pedido, user.email);
    onRefreshOrders();
  };

  const saveObsAppend = async (pedido: PedidoMapa) => {
    const key = buildPedidoReviewKey(pedido);
    const note = obsDraft[key]?.trim();
    if (!note) return;

    setBusyKey(`obs-${key}`);
    setActionError(null);
    try {
      const nextObs = appendObsPedido(pedido.obsPedido ?? '', note, user.email);
      await updateOrderRow(accessToken, { ...pedido, obsPedido: nextObs }, user.email);
      setObsDraft((prev) => ({ ...prev, [key]: '' }));
      onRefreshOrders();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao salvar observação.');
    } finally {
      setBusyKey(null);
    }
  };

  if (!list.length) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
        <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-3" />
        <p className="text-sm font-bold text-green-800">Nenhum pedido encontrado com estes filtros.</p>
        <p className="text-xs text-green-700 mt-1">Ajuste a busca ou limpe os filtros.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{actionError}</div>
      )}

      {list.map((p) => {
        const key = buildPedidoReviewKey(p);
        const review = reviewMap.get(key);
        const isReviewed = Boolean(review);
        const isBusy = busyKey === key || busyKey === `obs-${key}`;
        const ref = pedidoRefBadge(p);
        const qUpper = String(p.status ?? '').toUpperCase();
        const abUpper = String(p.obsCliente ?? '').toUpperCase();
        const tags: string[] = [];
        if (qUpper.includes('PENDENTE')) tags.push('PENDENTE');
        if (qUpper.includes('RMA') || abUpper.includes('RMA')) tags.push('RMA');
        const obsText = String(p.obsPedido ?? '').trim();
        const obsOpen = obsExpanded[key] ?? obsText.length <= 120;

        return (
          <div
            key={key}
            className={`rounded-xl border p-4 transition-colors ${
              isReviewed
                ? 'border-green-200 bg-green-50/60'
                : 'border-amber-200 bg-white shadow-sm'
            }`}
          >
            <div className="flex items-start gap-3">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void toggleReview(p, !isReviewed)}
                className={`mt-0.5 shrink-0 w-9 h-9 rounded-lg border-2 flex items-center justify-center transition ${
                  isReviewed
                    ? 'border-green-500 bg-green-500 text-white hover:bg-green-600'
                    : 'border-amber-400 bg-amber-50 text-amber-600 hover:bg-amber-100'
                } disabled:opacity-50`}
                title={isReviewed ? 'Desfazer revisão de hoje' : 'Marcar como revisado hoje'}
              >
                {isBusy && busyKey === key ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isReviewed ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <Circle className="w-5 h-5" />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-400">{p.data || '—'}</span>
                  {ref && (
                    <span className="text-[10px] font-mono bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">
                      {ref.kind} {ref.value}
                    </span>
                  )}
                  {p.numPedidoCli?.trim() && p.numPedidoDist?.trim() && ref?.kind !== 'OC' && (
                    <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                      OC {p.numPedidoCli.trim()}
                    </span>
                  )}
                  {tags.map((t) => (
                    <span
                      key={t}
                      className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        t === 'RMA' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <p className="mt-1 text-sm font-bold text-slate-800">{p.nomeCliente || '—'}</p>
                {p.cnpj && (
                  <p className="text-[11px] text-slate-500 font-mono">{formatCNPJ(p.cnpj.replace(/\D/g, ''))}</p>
                )}
                <p className="text-[11px] text-slate-500 mt-0.5">
                  <span className="font-semibold text-slate-600">{p.distribuidor || '—'}</span>
                  {' · '}
                  Q: <strong>{p.status || '—'}</strong>
                  {p.obsCliente ? (
                    <>
                      {' '}
                      · AB: <strong>{p.obsCliente}</strong>
                    </>
                  ) : null}
                </p>
                {isReviewed && review && (
                  <p className="text-[10px] text-green-700 mt-1.5">
                    Revisado hoje por {review.reviewedByName || review.reviewedBy}
                    {review.reviewedAt
                      ? ` às ${new Date(review.reviewedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                      : ''}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 gap-1.5">
                {isReviewed && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void toggleReview(p, false)}
                    className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
                    title="Desfazer check"
                  >
                    <Undo2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setEditPedido(p)}
                  className="p-2 rounded-lg text-purple-700 bg-purple-50 hover:bg-purple-100"
                  title="Editar pedido na planilha"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="mt-3 ml-12 rounded-lg border border-slate-200 bg-slate-50/80 p-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Obs. interna — col AA
              </p>
              {obsText ? (
                <div>
                  <p
                    className={`text-xs text-slate-700 whitespace-pre-line leading-relaxed ${
                      !obsOpen ? 'line-clamp-3' : ''
                    }`}
                  >
                    {obsText}
                  </p>
                  {obsText.length > 120 && (
                    <button
                      type="button"
                      onClick={() => setObsExpanded((prev) => ({ ...prev, [key]: !obsOpen }))}
                      className="text-[10px] font-semibold text-purple-600 mt-1 hover:underline"
                    >
                      {obsOpen ? 'Recolher' : 'Ver histórico completo'}
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Sem observações anteriores.</p>
              )}
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <input
                  type="text"
                  value={obsDraft[key] ?? ''}
                  onChange={(e) => setObsDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder="Acrescentar nota (não apaga o que já está escrito)…"
                  className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-purple-500"
                  disabled={isBusy}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void saveObsAppend(p);
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={isBusy || !obsDraft[key]?.trim()}
                  onClick={() => void saveObsAppend(p)}
                  className="inline-flex items-center justify-center gap-1.5 shrink-0 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white bg-slate-700 hover:bg-slate-800 disabled:opacity-40 rounded-lg"
                >
                  {busyKey === `obs-${key}` ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <MessageSquarePlus className="w-3.5 h-3.5" />
                  )}
                  Acrescentar
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {editPedido && (
        <OrderEditModal
          pedido={editPedido}
          user={user}
          accessToken={accessToken}
          onClose={() => setEditPedido(null)}
          onSave={handleSave}
          onNfUploaded={onRefreshOrders}
        />
      )}
    </div>
  );
}
