import { useNavigate } from 'react-router-dom';
import ClientRegisterForm from '../components/ClientRegisterForm';
import BinsightBrand from '../components/BinsightBrand';
import { useAuth } from '../contexts/AuthContext';

export default function RegisterPage() {
  const { user, token, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();

  if (!user || !token) return null;

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
      <ClientRegisterForm
        accessToken={token}
        email={user.email ?? ''}
        displayName={user.displayName ?? ''}
        onRegistered={handleRegistered}
      />
    </div>
  );
}
