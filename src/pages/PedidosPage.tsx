import { Navigate } from 'react-router-dom';
import OrderCardCliente from '../components/OrderCardCliente';
import { useAuth } from '../contexts/AuthContext';
import { sanitizePedidosForClient } from '../utils/sanitize';
import { canEditOrders } from '../utils/roles';

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
  } = useAuth();

  if (portalUser && canEditOrders(portalUser) && !isViewingAsClient) {
    return <Navigate to="/admin/pedidos" replace />;
  }
  const clientPedidos = sanitizePedidosForClient(pedidos);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Meus Pedidos</h1>
          {lastSync && (
            <p className="text-[11px] text-slate-400 mt-0.5">
              Atualizado às {lastSync.toLocaleTimeString('pt-BR')}
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

      {loadingOrders && clientPedidos.length === 0 ? (
        <p className="text-center py-16 text-slate-400 text-sm">Carregando pedidos...</p>
      ) : clientPedidos.length === 0 ? (
        <p className="text-center py-16 text-slate-400 text-sm">Nenhum pedido encontrado para seu CNPJ.</p>
      ) : (
        <div className="grid gap-4">
          {clientPedidos.map((p) => (
            <OrderCardCliente
              key={p.id}
              pedido={p}
              accessToken={token ?? undefined}
              userEmail={user?.email ?? undefined}
              onUpdated={refreshOrders}
            />
          ))}
        </div>
      )}
    </div>
  );
}
