import { useAuth } from '../contexts/AuthContext';
import type { MockLoginRole } from '../utils/mockAuth';

const ROLES: { id: MockLoginRole; label: string }[] = [
  { id: 'admin', label: 'Admin' },
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'cliente', label: 'Cliente' },
];

/** Troca de perfil no modo local sem login. */
export default function DevRoleSwitcher() {
  const { portalUser, loginAsDemo } = useAuth();
  if (!portalUser) return null;

  return (
    <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
      {ROLES.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => loginAsDemo(id)}
          className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wide transition ${
            portalUser.role === id
              ? 'bg-white text-purple-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
