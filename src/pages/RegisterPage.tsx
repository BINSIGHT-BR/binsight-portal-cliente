import { useNavigate } from 'react-router-dom';
import ClientRegisterForm from '../components/ClientRegisterForm';
import BinsightBrand from '../components/BinsightBrand';
import { useAuth } from '../contexts/AuthContext';

export default function RegisterPage() {
  const { user, token, authProvider, clientStatus, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();

  if (!user || !token) return null;

  const isGoogleFirstAccess = authProvider === 'google' && clientStatus === 'none';

  const handleRegistered = async () => {
    await refreshProfile();
    navigate('/aguardando', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 h-14 flex items-center justify-between">
        <BinsightBrand variant="header" />
        <button
          onClick={() => void logout()}
          className="text-xs text-slate-500 hover:text-slate-700"
        >
          Sair
        </button>
      </header>
      {isGoogleFirstAccess && (
        <div className="max-w-md mx-auto px-4 pt-6">
          <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-900 leading-relaxed">
            <strong>Primeiro acesso com Google</strong> — complete seu cadastro abaixo para solicitar
            acesso ao portal.
          </div>
        </div>
      )}
      <ClientRegisterForm
        accessToken={token}
        email={user.email ?? ''}
        displayName={user.displayName ?? user.email?.split('@')[0] ?? ''}
        googleFirstAccess={isGoogleFirstAccess}
        onRegistered={handleRegistered}
      />
    </div>
  );
}
