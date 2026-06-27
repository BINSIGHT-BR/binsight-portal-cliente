import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Filter, RefreshCw, Search } from 'lucide-react';
import PendingReviewList from '../components/PendingReviewList';
import { useAuth } from '../contexts/AuthContext';
import { useDailyReviewState } from '../hooks/useDailyReviewState';
import { canEditOrders } from '../utils/roles';
import { pedidoMatchesSearch } from '../utils/orderFilters';
import {
  filterDailyReviewList,
  type DailyReviewTipoFilter,
} from '../utils/pedidoReviewQueue';

export default function AdminRevisaoPage() {
  const { portalUser, token, pedidos, loadingOrders, ordersError, lastSync, refreshOrders } = useAuth();
  const { reviewDate, queue, reviewMap, remainingCount, reviewedCount, totalCount, error } =
    useDailyReviewState(pedidos);
  const [busca, setBusca] = useState('');
  const [distribuidorFiltro, setDistribuidorFiltro] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<DailyReviewTipoFilter>('');
  const [showReviewed, setShowReviewed] = useState(true);

  const distribuidorOptions = useMemo(() => {
    const s = new Set(queue.map((p) => p.distribuidor).filter(Boolean));
    return Array.from(s).sort();
  }, [queue]);

  const filteredQueue = useMemo(
    () =>
      filterDailyReviewList(
        queue,
        {
          search: busca,
          distribuidor: distribuidorFiltro || undefined,
          tipo: tipoFiltro || undefined,
        },
        pedidoMatchesSearch
      ),
    [queue, busca, distribuidorFiltro, tipoFiltro]
  );

  if (!portalUser || !canEditOrders(portalUser)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Revisão diária — Pendentes + RMA</h1>
          <p className="text-xs text-slate-500 mt-1">
            Confira col Q, col AB e obs. interna (col AA). Marque ✓ quando tratar o caso hoje —{' '}
            <strong>{reviewDate}</strong>
            {lastSync && (
              <> · pedidos atualizados às {lastSync.toLocaleTimeString('pt-BR')}</>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshOrders()}
          disabled={loadingOrders}
          className="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wide text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingOrders ? 'animate-spin' : ''}`} />
          Atualizar pedidos
        </button>
      </div>

      {(ordersError || error) && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {ordersError || error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Na fila hoje" value={totalCount} accent="amber" />
        <Stat label="A revisar" value={remainingCount} accent="orange" />
        <Stat label="Revisados hoje" value={reviewedCount} accent="green" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="relative sm:col-span-2 lg:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Nome, CNPJ, OC (col E), ped. distribuidor / BIN (col I)…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select
            value={distribuidorFiltro}
            onChange={(e) => setDistribuidorFiltro(e.target.value)}
            className="w-full pl-9 pr-8 py-2.5 text-sm border border-slate-200 rounded-xl appearance-none bg-white"
          >
            <option value="">Todos distribuidores</option>
            {distribuidorOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <select
          value={tipoFiltro}
          onChange={(e) => setTipoFiltro(e.target.value as DailyReviewTipoFilter)}
          className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl appearance-none bg-white"
        >
          <option value="">Pendente ou RMA</option>
          <option value="PENDENTE">Somente PENDENTE (col Q)</option>
          <option value="RMA">Somente RMA (Q ou AB)</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span>
          Exibindo <strong className="text-slate-700">{filteredQueue.length}</strong> de{' '}
          {queue.length} na fila
        </span>
        <label className="flex items-center gap-2 font-semibold text-slate-600 cursor-pointer ml-auto">
          <input
            type="checkbox"
            checked={showReviewed}
            onChange={(e) => setShowReviewed(e.target.checked)}
            className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
          />
          Mostrar já revisados
        </label>
      </div>

      {loadingOrders && pedidos.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">Carregando pedidos…</div>
      ) : token ? (
        <PendingReviewList
          pedidos={filteredQueue}
          user={portalUser}
          accessToken={token}
          reviewMap={reviewMap}
          onRefreshOrders={() => void refreshOrders()}
          showReviewed={showReviewed}
        />
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          Conecte o Google (login) para editar pedidos na planilha.
        </div>
      )}

      {remainingCount === 0 && totalCount > 0 && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center text-sm text-green-800 font-semibold">
          Todos os {totalCount} casos foram revisados hoje. Amanhã a fila reinicia automaticamente.
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: 'amber' | 'orange' | 'green';
}) {
  const colors = {
    amber: 'text-amber-700 border-amber-200',
    orange: 'text-orange-700 border-orange-200',
    green: 'text-green-700 border-green-200',
  };
  return (
    <div className={`bg-white border rounded-xl px-4 py-3 text-center ${colors[accent]}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-2xl font-black tabular-nums">{value}</p>
    </div>
  );
}
