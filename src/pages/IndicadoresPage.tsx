import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { BarChart3, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import IndicatorFiltersBar from '../components/indicators/IndicatorFilters';
import KpiCards from '../components/indicators/KpiCards';
import OrdersByMonthChart from '../components/indicators/OrdersByMonthChart';
import StatusMixChart from '../components/indicators/StatusMixChart';
import PgtoChart from '../components/indicators/PgtoChart';
import SummaryMatrix from '../components/indicators/SummaryMatrix';
import {
  buildIndicatorSummary,
  defaultIndicatorFilters,
  listDistribuidores,
  type IndicatorFilters as IndicatorFilterState,
} from '../utils/orderIndicators';
import { canViewFinanceIndicators } from '../utils/roles';

export default function IndicadoresPage() {
  const { portalUser, pedidos, loadingOrders, lastSync, refreshOrders } = useAuth();
  const [filters, setFilters] = useState<IndicatorFilterState>(() => defaultIndicatorFilters());

  const distribuidores = useMemo(() => listDistribuidores(pedidos), [pedidos]);

  const summary = useMemo(
    () => buildIndicatorSummary(pedidos, filters),
    [pedidos, filters]
  );

  const vendedores = summary.vendedores;

  if (!portalUser) return null;
  if (!canViewFinanceIndicators(portalUser)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-purple-700">
            <BarChart3 className="w-5 h-5" />
            <h1 className="text-2xl font-bold text-slate-900">Indicadores</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Vendas do Mapa (aba CONSOLIDADO). Cada registro da planilha conta como uma venda —
            útil para volume operacional e acompanhamento do financeiro.
          </p>
          {lastSync && (
            <p className="text-[11px] text-slate-400 mt-1">
              Dados do Mapa atualizados às {lastSync.toLocaleTimeString('pt-BR')}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void refreshOrders()}
          disabled={loadingOrders}
          className="inline-flex items-center gap-2 text-xs font-bold uppercase text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-2 rounded-lg disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingOrders ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      <IndicatorFiltersBar
        filters={filters}
        vendedores={vendedores}
        distribuidores={distribuidores}
        onChange={setFilters}
        onReset={() => setFilters(defaultIndicatorFilters())}
      />

      <KpiCards kpis={summary.kpis} />

      <section className="bg-white border border-slate-200 rounded-xl p-4">
        <h2 className="text-sm font-bold text-slate-800 mb-1">Vendas por mês (por vendedor)</h2>
        <p className="text-[10px] text-slate-500 mb-4">
          Barras empilhadas — legenda por vendedor (col. B)
        </p>
        <OrdersByMonthChart
          data={summary.byMonthVendedor}
          vendedores={summary.vendedores}
          activeVendedores={filters.vendedores}
        />
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-4">
        <h2 className="text-sm font-bold text-slate-800 mb-1">Composição por status</h2>
        <p className="text-[10px] text-slate-500 mb-4">
          Pendente, faturado, entregue, cancelado e RMA — por mês de pedido (col. A)
        </p>
        <StatusMixChart data={summary.byMonthBucket} />
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-4">
        <h2 className="text-sm font-bold text-slate-800 mb-1">Status de pagamento</h2>
        <p className="text-[10px] text-slate-500 mb-4">Col. P — vencida, a vencer, em dia</p>
        <PgtoChart data={summary.byMonthPgto} />
      </section>

      <SummaryMatrix rows={summary.matrixRows} />
    </div>
  );
}
