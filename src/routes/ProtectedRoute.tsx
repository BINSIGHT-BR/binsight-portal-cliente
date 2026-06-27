import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { canEditOrders } from '../utils/roles';

export function ProtectedRoute() {
  const { needsAuth, portalUser, clientStatus, skipAuth } = useAuth();
  const location = useLocation();

  if (needsAuth && !skipAuth) return <Navigate to="/login" replace />;
  if (!portalUser) return null;

  if (portalUser.role === 'cliente') {
    const path = location.pathname;
    const allowedWhilePending = ['/aguardando'];
    if (clientStatus === 'none' && path !== '/cadastro') {
      return <Navigate to="/cadastro" replace />;
    }
    if (clientStatus === 'pendente' && !allowedWhilePending.includes(path)) {
      return <Navigate to="/aguardando" replace />;
    }
    if (clientStatus === 'revogado' && path !== '/revogado') {
      return <Navigate to="/revogado" replace />;
    }
    if (clientStatus === 'ativo' && ['/cadastro', '/aguardando', '/revogado'].includes(path)) {
      return <Navigate to="/" replace />;
    }
  }

  return <Outlet />;
}

export function StaffOnlyRoute() {
  const { portalUser } = useAuth();
  if (!portalUser || !canEditOrders(portalUser)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

export function GuestRoute() {
  const { needsAuth, portalUser, skipAuth } = useAuth();
  if (skipAuth || (!needsAuth && portalUser)) return <Navigate to="/" replace />;
  return <Outlet />;
}
