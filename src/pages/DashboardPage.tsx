import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Package } from 'lucide-react';
import AlertBanner from '../components/AlertBanner';
import OrderCardCliente from '../components/OrderCardCliente';
import { useAuth } from '../contexts/AuthContext';
import { computeOrderAlerts } from '../utils/alerts';
import { sanitizePedidosForClient } from '../utils/sanitize';
import { canEditOrders } from '../utils/roles';
import { fetchAlertasFromApi } from '../utils/clienteApi';
import { USE_MOCK_DATA, USE_OAUTH_SHEETS } from '../constants/columns';
import { OrderAlert } from '../types';

export default function DashboardPage() {
  const { portalUser, pedidos, loadingOrders, lastSync, usingMockData, refreshOrders, token, user, isViewingAsClient } =
    useAuth();
  const [liveAlerts, setLiveAlerts] = useState<OrderAlert[]>([]);

  useEffect(() => {
    if (!portalUser || !canEditOrders(portalUser)) return;
    if (USE_MOCK_DATA || USE_OAUTH_SHEETS) {
      setLiveAlerts(computeOrderAlerts(pedidos));
      return;
    }
    fetchAlertasFromApi()
      .then(setLiveAlerts)
      .catch(() => setLiveAlerts(computeOrderAlerts(pedidos)));
  }, [portalUser, pedidos]);

  if (!portalUser) return null;

  const isClient = portalUser.role === 'cliente' || isViewingAsClient;
  const clientPedidos = sanitizePedidosForClient(pedidos);
  const recent = isClient ? clientPedidos.slice(0, 3) : pedidos.slice(0, 5);
  const alerts = canEditOrders(portalUser) ? liveAlerts : [];

  const stats = isClient
    ? {
        total: clientPedidos.length,
        emAndamento: clientPedidos.filter(
          (p) => !p.obsCliente.toLowerCase().includes('entregue') && !p.obsCliente.toLowerCase().includes('licença')
        ).length,
        concluidos: clientPedidos.filter(
          (p) =>
            p.obsCliente.toLowerCase().includes('entregue') ||
            p.obsCliente.toLowerCase().includes('licença') ||
            p.obsCliente.toLowerCase().includes('licenca')
        ).length,
      }
    : {
        total: pedidos.length,
        emAndamento: pedidos.filter((p) => !p.status.toUpperCase().includes('FINALIZADO')).length,
        concluidos: pedidos.filter((p) =>
          ['FINALIZADO', 'ENTREGUE', 'FATURADO'].some((s) => p.status.toUpperCase().includes(s))
        ).length,
      };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Olá, {portalUser.displayName.split(' ')[0]}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {isClient
            ? 'Acompanhe o status dos seus pedidos BInsight em tempo real.'
            : 'Visão geral do Mapa de Vendas e alertas operacionais.'}
          {usingMockData && ' · Modo demonstração ativo.'}
        </p>
        {lastSync && (
          <p className="text-[11px] text-slate-400 mt-1">
            Atualizado às {lastSync.toLocaleTimeString('pt-BR')}
          </p>
        )}
      </div>

      {!isClient && alerts.length > 0 && <AlertBanner alerts={alerts} />}

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Em andamento" value={stats.emAndamento} />
        <StatCard label="Concluídos" value={stats.concluidos} />
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            {isClient ? 'Pedidos recentes' : 'Últimos pedidos'}
          </h2>
          <Link
            to={isClient ? '/pedidos' : '/admin/pedidos'}
            className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 hover:text-purple-800"
          >
            Ver todos
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loadingOrders && recent.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">Carregando...</p>
        ) : recent.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">Nenhum pedido encontrado.</p>
          </div>
        ) : isClient ? (
          <div className="grid gap-4">
            {clientPedidos.slice(0, 3).map((p) => (
              <OrderCardCliente
                key={p.id}
                pedido={p}
                accessToken={token ?? undefined}
                userEmail={user?.email ?? undefined}
                onUpdated={refreshOrders}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {pedidos.slice(0, 5).map((p) => (
              <div key={p.rowNum} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{p.nomeCliente}</p>
                  <p className="text-[11px] text-slate-400">{p.numPedidoCli || p.numNF || '—'} · {p.status}</p>
                </div>
                <span className="text-[10px] font-mono text-slate-400 shrink-0">{p.data}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-4 text-center">
      <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
    </div>
  );
}
