import { type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, LogOut, Package, Shield, UserCircle, Users } from 'lucide-react';
import BinsightBrand from '../components/BinsightBrand';
import AdminClientPreviewBar from '../components/AdminClientPreviewBar';
import MustChangePasswordModal from '../components/MustChangePasswordModal';
import DevRoleSwitcher from '../components/DevRoleSwitcher';
import { useAuth } from '../contexts/AuthContext';
import { canManageClientAccess, roleLabel } from '../utils/roles';
import { USE_MOCK_DATA } from '../constants/columns';

export default function AppLayout() {
  const { portalUser, logout, skipAuth, isViewingAsClient, canUseClientPreview } = useAuth();
  if (!portalUser) return null;

  const isStaff = portalUser.role !== 'cliente' && !isViewingAsClient;
  const showAccessNav = canManageClientAccess(portalUser) && !isViewingAsClient;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <MustChangePasswordModal />
      {canUseClientPreview && <AdminClientPreviewBar />}
      <header className="bg-white border-b border-slate-100/80 sticky top-0 z-40 shadow-sm shrink-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-16 gap-4">
            <BinsightBrand variant="header" subtitle="BInsight Connect" />

            <div className="flex items-center gap-3 text-xs font-semibold">
              {USE_MOCK_DATA && (
                <span className="hidden sm:inline text-[9px] font-bold uppercase tracking-wide text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                  {skipAuth ? 'Local sem login' : 'Demo'}
                </span>
              )}
              {skipAuth && <DevRoleSwitcher />}
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-purple-700 bg-purple-50 px-2 py-1 rounded-lg">
                <Shield className="w-3 h-3" />
                {isViewingAsClient ? 'Visão cliente' : roleLabel(portalUser.role)}
              </span>
              <span className="hidden md:block text-slate-500 truncate max-w-[160px]">
                {portalUser.displayName}
              </span>
              <button
                onClick={() => void logout()}
                className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-[10px] uppercase tracking-wide py-1.5 px-3 rounded-lg transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </div>
        </div>

        <nav className="border-t border-slate-100 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto">
            <NavItem to="/" end icon={<LayoutDashboard className="w-4 h-4" />} label="Início" />
            {isStaff ? (
              <NavItem
                to="/admin/pedidos"
                icon={<Package className="w-4 h-4" />}
                label="Mapa Pedidos"
              />
            ) : (
              <>
                <NavItem to="/pedidos" icon={<Package className="w-4 h-4" />} label="Meus Pedidos" />
                <NavItem
                  to="/perfil"
                  icon={<UserCircle className="w-4 h-4" />}
                  label="Meu perfil"
                />
              </>
            )}
            {showAccessNav && (
              <NavItem
                to="/admin/acessos"
                icon={<Users className="w-4 h-4" />}
                label="Acessos Clientes"
              />
            )}
          </div>
        </nav>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 lg:py-8">
        <Outlet />
      </main>

      <footer className="text-center text-[9px] text-slate-400/80 py-3 font-mono shrink-0 border-t border-slate-100 bg-white">
        BInsight Connect · Portal do Cliente v1.0
      </footer>
    </div>
  );
}

function NavItem({
  to,
  end,
  icon,
  label,
}: {
  to: string;
  end?: boolean;
  icon: ReactNode;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wide border-b-2 transition whitespace-nowrap ${
          isActive
            ? 'border-purple-600 text-purple-700'
            : 'border-transparent text-slate-400 hover:text-slate-600'
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}
