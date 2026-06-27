import { useMemo, useState, useEffect } from 'react';
import { Filter, Search } from 'lucide-react';
import OrderCardCliente from '../components/OrderCardCliente';
import { useAuth } from '../contexts/AuthContext';
import { sanitizePedidosForClient } from '../utils/sanitize';
import { canEditOrders } from '../utils/roles';
import { filterPedidosForClient } from '../utils/orderFilters';
import { clientStatusForFilter } from '../utils/clientOrderStatus';
import { Navigate } from 'react-router-dom';

export default function PedidosPage() {
  const {
    portalUser,
    pedidos,
    loadingOrders,
    ordersError,
    lastSync,
    refreshOrders,
    token,
    user,
    isViewingAsClient,
    clearOrdersError,
  } = useAuth();

  useEffect(() => {
    clearOrdersError();
  }, [clearOrdersError]);

  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [distribuidorFiltro, setDistribuidorFiltro] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const filteredRaw = useMemo(
    () =>
      filterPedidosForClient(pedidos, {
        search: busca || undefined,
        status: statusFiltro || undefined,
        distribuidor: distribuidorFiltro || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
    [pedidos, busca, statusFiltro, distribuidorFiltro, dateFrom, dateTo]
  );

  const clientPedidos = useMemo(
    () => sanitizePedidosForClient(filteredRaw),
    [filteredRaw]
  );

  const statusOptions = useMemo(() => {
    const s = new Set(pedidos.map((p) => clientStatusForFilter(p)).filter(Boolean));
    return Array.from(s).sort();
  }, [pedidos]);

  const distribuidorOptions = useMemo(() => {
    const s = new Set(pedidos.map((p) => p.distribuidor.trim()).filter(Boolean));
    return Array.from(s).sort();
  }, [pedidos]);

  const hasActiveFilters = Boolean(busca || statusFiltro || distribuidorFiltro || dateFrom || dateTo);

  if (portalUser && canEditOrders(portalUser) && !isViewingAsClient) {
    return <Navigate to="/admin/pedidos" replace />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Meus Pedidos</h1>
          {lastSync && (
            <p className="text-[11px] text-slate-400 mt-0.5">
              Atualizado às {lastSync.toLocaleTimeString('pt-BR')}
              {hasActiveFilters && clientPedidos.length !== pedidos.length && (
                <> · {clientPedidos.length} de {pedidos.length} pedidos</>
              )}
            </p>
          )}
        </div>
        <button
          onClick={() => void refreshOrders()}
          disabled={loadingOrders}
          className="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wide text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg disabled:opacity-50"
        >
          Atualizar
        </button>
      </div>

      {ordersError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {ordersError}
        </div>
      )}

      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar produto, NF, pedido, BIN, distribuidor..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 bg-white"
          />
        </div>

        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 hover:text-purple-700"
        >
          <Filter className="w-3.5 h-3.5" />
          {showFilters ? 'Ocultar filtros' : 'Filtros'}
          {hasActiveFilters && !showFilters && (
            <span className="text-[10px] normal-case font-semibold text-purple-600">(ativos)</span>
          )}
        </button>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 p-3 bg-white border border-slate-200 rounded-xl">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Status</label>
              <select
                value={statusFiltro}
                onChange={(e) => setStatusFiltro(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-2 py-2 bg-white"
              >
                <option value="">Todos</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Distribuidor
              </label>
              <select
                value={distribuidorFiltro}
                onChange={(e) => setDistribuidorFiltro(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-2 py-2 bg-white"
              >
                <option value="">Todos</option>
                {distribuidorOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Data — de
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-2 py-2"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Data — até
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-2 py-2"
              />
            </div>
            {hasActiveFilters && (
              <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setBusca('');
                    setStatusFiltro('');
                    setDistribuidorFiltro('');
                    setDateFrom('');
                    setDateTo('');
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-purple-700"
                >
                  Limpar filtros
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {loadingOrders && clientPedidos.length === 0 ? (
        <p className="text-center py-16 text-slate-400 text-sm">Carregando pedidos...</p>
      ) : clientPedidos.length === 0 ? (
        <p className="text-center py-16 text-slate-400 text-sm">
          {hasActiveFilters
            ? 'Nenhum pedido corresponde aos filtros.'
            : 'Nenhum pedido encontrado para seu CNPJ.'}
        </p>
      ) : (
        <div className="grid gap-4">
          {clientPedidos.map((p) => (
            <OrderCardCliente
              key={p.id}
              pedido={p}
              accessToken={token ?? undefined}
              userEmail={user?.email ?? portalUser?.email}
              onUpdated={refreshOrders}
            />
          ))}
        </div>
      )}
    </div>
  );
}
