import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import { ProtectedRoute, GuestRoute } from './routes/ProtectedRoute';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import CreateAccountPage from './pages/CreateAccountPage';
import DashboardPage from './pages/DashboardPage';
import PedidosPage from './pages/PedidosPage';
import AdminPedidosPage from './pages/AdminPedidosPage';
import AdminAcessosPage from './pages/AdminAcessosPage';
import AdminRevisaoPage from './pages/AdminRevisaoPage';
import RegisterPage from './pages/RegisterPage';
import PendingPage from './pages/PendingPage';
import ProfilePage from './pages/ProfilePage';

function CatchAllRedirect() {
  const { needsAuth, skipAuth } = useAuth();
  return <Navigate to={needsAuth && !skipAuth ? '/login' : '/'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/criar-conta" element={<CreateAccountPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/cadastro" element={<RegisterPage />} />
        <Route path="/aguardando" element={<PendingPage variant="pendente" />} />
        <Route path="/revogado" element={<PendingPage variant="revogado" />} />

        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/pedidos" element={<PedidosPage />} />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="/admin/pedidos" element={<AdminPedidosPage />} />
          <Route path="/admin/revisao" element={<AdminRevisaoPage />} />
          <Route path="/admin/acessos" element={<AdminAcessosPage />} />
        </Route>
      </Route>

      <Route path="*" element={<CatchAllRedirect />} />
    </Routes>
  );
}
