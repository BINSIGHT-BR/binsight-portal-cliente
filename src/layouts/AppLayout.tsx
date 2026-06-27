import { type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ClipboardCheck, LayoutDashboard, LogOut, Package, Shield, UserCircle, Users } from 'lucide-react';
import DailyReviewPopup from '../components/DailyReviewPopup';
import { useDailyReviewState } from '../hooks/useDailyReviewState';
import { canEditOrders, canManageClientAccess, roleLabel } from '../utils/roles';
import BinsightBrand from '../components/BinsightBrand';
import AdminClientPreviewBar from '../components/AdminClientPreviewBar';
import MustChangePasswordModal from '../components/MustChangePasswordModal';
import DevRoleSwitcher from '../components/DevRoleSwitcher';
import SheetsConnectBanner from '../components/SheetsConnectBanner';
import { useAuth } from '../contexts/AuthContext';
import { USE_MOCK_DATA } from '../constants/columns';
import { formatNavBadgeCount } from '../utils/navBadge';

export default function AppLayout() {
  const {
    portalUser,
    logout,
    skipAuth,
    isViewingAsClient,
    canUseClientPreview,
    pendingAccessCount,
    clientStatus,
    pedidos,
    needsSheetsAccess,
    connectingSheets,
    connectSheets,
  } = useAuth();

  const showDailyReview = Boolean(
    portalUser && canEditOrders(portalUser) && !isViewingAsClient
  );
  const dailyReview = useDailyReviewState(showDailyReview ? pedidos : []);

  if (!portalUser) return null;

  const isStaff = portalUser.role !== 'cliente' && !isViewingAsClient;
  const showClientProfile = !isStaff && clientStatus === 'ativo';
  const showAccessNav = canManageClientAccess(portalUser) && !isViewingAsClient;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <MustChangePasswordModal />
      {showDailyReview && (
        <DailyReviewPopup
          remainingCount={dailyReview.remainingCount}
          totalCount={dailyReview.totalCount}
          reviewedCount={dailyReview.reviewedCount}
          reviewDate={dailyReview.reviewDate}
        />
      )}
      {canUseClientPreview && isViewingAsClient && <AdminClientPreviewBar />}
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
              {needsSheetsAccess && (
                <SheetsConnectBanner
                  compact
                  connecting={connectingSheets}
                  onConnect={() => void connectSheets()}
                />
              )}
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
              <>
                <NavItem
                  to="/admin/pedidos"
                  icon={<Package className="w-4 h-4" />}
                  label="Mapa Pedidos"
                />
                {showDailyReview && (
                  <NavItem
                    to="/admin/revisao"
                    icon={<ClipboardCheck className="w-4 h-4" />}
                    label="Revisão diária"
                    badge={dailyReview.remainingCount > 0 ? dailyReview.remainingCount : undefined}
                    badgeMax={999}
                  />
                )}
              </>
            ) : (
              <>
                <NavItem to="/pedidos" icon={<Package className="w-4 h-4" />} label="Meus Pedidos" />
                {showClientProfile && (
                  <NavItem
                    to="/perfil"
                    icon={<UserCircle className="w-4 h-4" />}
                    label="Meu perfil"
                  />
                )}
              </>
            )}
            {showAccessNav && (
              <NavItem
                to="/admin/acessos"
                icon={<Users className="w-4 h-4" />}
                label="Acessos Clientes"
                badge={pendingAccessCount > 0 ? pendingAccessCount : undefined}
                badgeMax={9}
              />
            )}
          </div>
        </nav>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 lg:py-8">
        {needsSheetsAccess && (
          <div className="mb-6">
            <SheetsConnectBanner
              connecting={connectingSheets}
              onConnect={() => void connectSheets()}
            />
          </div>
        )}
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
  badge,
  badgeMax,
}: {
  to: string;
  end?: boolean;
  icon: ReactNode;
  label: string;
  badge?: number;
  /** Se definido, exibe "N+" acima deste valor. Omitir para mostrar o número real (até 999). */
  badgeMax?: number;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `relative flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wide border-b-2 transition whitespace-nowrap ${
          isActive
            ? 'border-purple-600 text-purple-700'
            : 'border-transparent text-slate-400 hover:text-slate-600'
        }`
      }
    >
      <span className="relative inline-flex">
        {icon}
        {badge != null && badge > 0 && (
          <span
            className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white tabular-nums"
            title={`${badge} pendente(s)`}
          >
            {formatNavBadgeCount(badge, badgeMax)}
          </span>
        )}
      </span>
      {label}
    </NavLink>
  );
}
