import { Navigate } from 'react-router-dom';
import ClientAccessPanel from '../components/ClientAccessPanel';
import { useAuth } from '../contexts/AuthContext';
import { canManageClientAccess } from '../utils/roles';

export default function AdminAcessosPage() {
  const { portalUser, token } = useAuth();

  if (!portalUser || !canManageClientAccess(portalUser) || !token) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Acessos de Clientes</h1>
        <p className="text-sm text-slate-500 mt-1">
          Aprove, revogue ou gerencie CNPJs vinculados a contas externas.
        </p>
      </div>
      <ClientAccessPanel accessToken={token} adminEmail={portalUser.email} />
    </div>
  );
}
