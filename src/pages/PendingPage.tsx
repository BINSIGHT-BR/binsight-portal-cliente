import { Loader2, RefreshCw, UserCircle } from 'lucide-react';
import BinsightBrand from '../components/BinsightBrand';
import { useAuth } from '../contexts/AuthContext';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

interface Props {
  variant: 'pendente' | 'revogado';
}

export default function PendingPage({ variant }: Props) {
  const { logout, refreshProfile } = useAuth();
  const [checking, setChecking] = useState(false);
  const navigate = useNavigate();

  const copy =
    variant === 'pendente'
      ? {
          title: 'Aguardando aprovação',
          body: 'Sua solicitação foi enviada. A equipe BInsight validará seu CNPJ e liberará o acesso em breve (geralmente em horário comercial).',
          cls: 'bg-amber-50 border-amber-200 text-amber-800',
        }
      : {
          title: 'Acesso revogado',
          body: 'Entre em contato com seu representante BInsight para restabelecer o acesso.',
          cls: 'bg-red-50 border-red-200 text-red-800',
        };

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      const status = await refreshProfile();
      if (status === 'ativo') {
        navigate('/', { replace: true });
      }
    } finally {
      setChecking(false);
    }
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
      <div className="max-w-md mx-auto text-center py-16 px-4 flex-1 space-y-4">
        <div className={`border rounded-2xl p-8 ${copy.cls.split(' ')[0]} ${copy.cls.split(' ')[1]}`}>
          <h2 className={`text-lg font-bold ${copy.cls.split(' ')[2]}`}>{copy.title}</h2>
          <p className={`text-sm mt-2 opacity-90 ${copy.cls.split(' ')[2]}`}>{copy.body}</p>
        </div>

        {variant === 'pendente' && (
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => void handleCheckStatus()}
              disabled={checking}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-xl disabled:opacity-50"
            >
              {checking ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Verificar status
            </button>
            <Link
              to="/perfil"
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-purple-700"
            >
              <UserCircle className="w-4 h-4" />
              Preferências de e-mail
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
