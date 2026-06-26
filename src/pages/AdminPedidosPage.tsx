import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import AlertBanner from '../components/AlertBanner';
import OrdersList from '../components/OrdersList';
import { useAuth } from '../contexts/AuthContext';
import { computeOrderAlerts } from '../utils/alerts';
import { canEditOrders } from '../utils/roles';
import { fetchAlertasFromApi } from '../utils/clienteApi';
import { USE_MOCK_DATA, USE_OAUTH_SHEETS } from '../constants/columns';
import { MapaKind, OrderAlert } from '../types';

export default function AdminPedidosPage() {
  const { portalUser, token, pedidos, loadingOrders, ordersError, lastSync, refreshOrders, addMockPedido } =
    useAuth();
  const [alerts, setAlerts] = useState<OrderAlert[]>([]);
  const [focusOrder, setFocusOrder] = useState<{ rowNum: number; mapaKind?: MapaKind } | null>(null);
  const [buscaFromAlert, setBuscaFromAlert] = useState<string | null>(null);

  useEffect(() => {
    if (!portalUser || !canEditOrders(portalUser)) return;
    if (USE_MOCK_DATA || USE_OAUTH_SHEETS) {
      setAlerts(computeOrderAlerts(pedidos));
      return;
    }
    fetchAlertasFromApi()
      .then(setAlerts)
      .catch(() => setAlerts(computeOrderAlerts(pedidos)));
  }, [portalUser, pedidos]);

  const handleSelectAlert = (alert: OrderAlert) => {
    setFocusOrder({ rowNum: alert.pedido.rowNum, mapaKind: alert.pedido.mapaKind });
    setBuscaFromAlert(alert.pedido.nomeCliente || alert.pedido.numPedidoCli);
    window.setTimeout(() => setFocusOrder(null), 8000);
  };

  if (!portalUser || !canEditOrders(portalUser)) {
    return <Navigate to="/" replace />;
  }

  const title =
    portalUser.role === 'admin' ? 'Todos os Pedidos' : 'Mapa de Pedidos — Financeiro';

  return (
    <div className="space-y-6">
      <AlertBanner alerts={alerts} onSelectAlert={handleSelectAlert} />
      {token && (
        <OrdersList
          pedidos={pedidos}
          user={portalUser}
          accessToken={token}
          loading={loadingOrders}
          error={ordersError}
          lastSync={lastSync}
          onRefresh={refreshOrders}
          onMockCreate={addMockPedido}
          title={title}
          focusOrder={focusOrder}
          initialSearch={buscaFromAlert ?? undefined}
        />
      )}
    </div>
  );
}
