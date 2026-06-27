import { useEffect, useMemo, useState } from 'react';
import { PedidoMapa, PortalUser } from '../types';
import { Plus, RefreshCw, Search, Filter } from 'lucide-react';
import OrderCard from './OrderCard';
import OrderEditModal from './OrderEditModal';
import OrderCreateModal from './OrderCreateModal';
import { canEditOrders } from '../utils/roles';
import { USE_MOCK_DATA } from '../constants/columns';
import {
  createOrderRow,
  deleteOrderRow,
  updateOrderRow,
  type PedidosFilters,
} from '../utils/orders';
import { filterPedidos } from '../utils/orderFilters';
import { orderDomId } from '../utils/driveDocumentView';
import type { MapaKind } from '../types';

interface Props {
  pedidos: PedidoMapa[];
  user: PortalUser;
  accessToken: string;
  loading: boolean;
  error: string | null;
  lastSync: Date | null;
  onRefresh: () => void;
  onMockCreate?: (partial: Partial<PedidoMapa>) => void;
  title?: string;
  focusOrder?: { rowNum: number; mapaKind?: MapaKind } | null;
  initialSearch?: string;
}

export default function OrdersList({
  pedidos,
  user,
  accessToken,
  loading,
  error,
  lastSync,
  onRefresh,
  onMockCreate,
  title = 'Meus Pedidos',
  focusOrder,
  initialSearch,
}: Props) {
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [distribuidorFiltro, setDistribuidorFiltro] = useState('');
  const [statusPgtoFiltro, setStatusPgtoFiltro] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [editPedido, setEditPedido] = useState<PedidoMapa | null>(null);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const statusOptions = useMemo(() => {
    const s = new Set(pedidos.map((p) => p.status).filter(Boolean));
    return Array.from(s).sort();
  }, [pedidos]);

  const distribuidorOptions = useMemo(() => {
    const s = new Set(pedidos.map((p) => p.distribuidor).filter(Boolean));
    return Array.from(s).sort();
  }, [pedidos]);

  const filtered = useMemo(() => {
    const filters: PedidosFilters = {
      search: busca || undefined,
      status: statusFiltro || undefined,
      distribuidor: distribuidorFiltro || undefined,
      statusPgto: statusPgtoFiltro || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    };
    return filterPedidos(pedidos, filters);
  }, [pedidos, busca, statusFiltro, distribuidorFiltro, statusPgtoFiltro, dateFrom, dateTo]);

  useEffect(() => {
    if (initialSearch) setBusca(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    if (!focusOrder) return;
    const id = orderDomId(focusOrder.rowNum, focusOrder.mapaKind);
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    return () => window.clearTimeout(t);
  }, [focusOrder, filtered.length]);

  const counts = useMemo(
    () => ({
      total: filtered.length,
      faturados: filtered.filter((p) => p.status.toUpperCase().includes('FATURADO')).length,
      pendentes: filtered.filter((p) => p.status.toUpperCase().includes('PENDENTE')).length,
    }),
    [filtered]
  );

  const handleSave = async (pedido: PedidoMapa) => {
    await updateOrderRow(accessToken, pedido, user.email);
    onRefresh();
  };

  const handleCreateSubmit = async (partial: Partial<PedidoMapa>) => {
    if (USE_MOCK_DATA) {
      onMockCreate?.(partial);
      return;
    }
    await createOrderRow(accessToken, partial, user.email);
    onRefresh();
  };

  const handleDelete = async (pedido: PedidoMapa) => {
    if (!window.confirm(`Excluir pedido linha ${pedido.rowNum} — ${pedido.nomeCliente}?`)) return;
    if (USE_MOCK_DATA) {
      setActionError('Exclusão indisponível em modo mock.');
      return;
    }
    setActionError(null);
    try {
      await deleteOrderRow(accessToken, pedido.rowNum, pedido.mapaKind);
      onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao excluir.');
    }
  };

  const editable = canEditOrders(user);
  const canCreate = editable;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          {lastSync && (
            <p className="text-[11px] text-slate-400 mt-0.5">
              Atualizado às {lastSync.toLocaleTimeString('pt-BR')}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {canCreate && (
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white bg-purple-700 hover:bg-purple-800 rounded-lg"
            >
              <Plus className="w-3.5 h-3.5" />
              Novo pedido
            </button>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wide text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {(error || actionError) && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error || actionError}
        </div>
      )}

      {USE_MOCK_DATA && editable && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Modo demo: pedidos criados aqui ficam só na sessão local. Para gravar no Mapa real, use{' '}
          <code className="font-mono text-[10px]">VITE_USE_MOCK_DATA=false</code> e login Google como
          financeiro@.
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total" value={counts.total} />
        <Stat label="Faturados" value={counts.faturados} />
        <Stat label="Pendentes" value={counts.pendentes} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar cliente, CNPJ, NF, OC, ped. dist. (BIN…)..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <FilterSelect
          icon
          value={statusFiltro}
          onChange={setStatusFiltro}
          placeholder="Status pedido"
          options={statusOptions}
        />
        <FilterSelect
          value={distribuidorFiltro}
          onChange={setDistribuidorFiltro}
          placeholder="Distribuidor"
          options={distribuidorOptions}
        />
        <FilterSelect
          value={statusPgtoFiltro}
          onChange={setStatusPgtoFiltro}
          placeholder="Status pagamento"
          options={['EM DIA', 'A VENCER', 'VENCIDA', 'SEM DATA', 'PAGA']}
        />
        <div>
          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1 px-0.5">
            Data pedido — de
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1 px-0.5">
            Data pedido — até
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5"
          />
        </div>
      </div>

      {loading && pedidos.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">Carregando pedidos...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">Nenhum pedido encontrado.</div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((p) => {
            const highlighted =
              focusOrder?.rowNum === p.rowNum &&
              (focusOrder.mapaKind ?? 'pedido') === (p.mapaKind ?? 'pedido');
            return (
              <OrderCard
                key={`${p.mapaKind ?? 'pedido'}-${p.rowNum}-${p.numNF}-${p.descricaoProduto.slice(0, 20)}`}
                pedido={p}
                user={user}
                accessToken={accessToken}
                highlighted={highlighted}
                onEdit={editable ? setEditPedido : undefined}
                onDelete={editable ? handleDelete : undefined}
              />
            );
          })}
        </div>
      )}

      {creating && (
        <OrderCreateModal
          user={user}
          accessToken={accessToken}
          onClose={() => setCreating(false)}
          onSubmit={handleCreateSubmit}
        />
      )}

      {editPedido && (
        <OrderEditModal
          pedido={editPedido}
          user={user}
          accessToken={accessToken}
          onClose={() => setEditPedido(null)}
          onSave={handleSave}
          onNfUploaded={onRefresh}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-center">
      <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{label}</p>
      <p className="text-lg font-bold text-slate-800">{value}</p>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
  icon,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: string[];
  icon?: boolean;
}) {
  return (
    <div className="relative">
      {icon && <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full pr-8 py-2.5 text-sm border border-slate-200 rounded-xl appearance-none bg-white ${icon ? 'pl-9' : 'pl-3'}`}
      >
        <option value="">{placeholder}</option>
        {options.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}
