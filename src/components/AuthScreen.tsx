import { FormEvent, useState } from 'react';
import BinsightBrand from './BinsightBrand';
import { USE_MOCK_DATA } from '../constants/columns';
import type { MockLoginRole } from '../utils/mockAuth';

interface Props {
  onLogin: () => void;
  onLoginWithCredentials?: (email: string, password: string) => void;
  onLoginAsDemo?: (role: MockLoginRole) => void;
  isLoggingIn: boolean;
  authError?: string | null;
  usingMockData?: boolean;
}

export default function AuthScreen({
  onLogin,
  onLoginWithCredentials,
  onLoginAsDemo,
  isLoggingIn,
  authError,
  usingMockData = USE_MOCK_DATA,
}: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const showEmailLogin = !usingMockData && Boolean(onLoginWithCredentials);

  const handleEmailLogin = (e: FormEvent) => {
    e.preventDefault();
    onLoginWithCredentials?.(email.trim(), password);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30" />
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <BinsightBrand subtitle="BInsight Connect · Portal do Cliente" />

        <div className="mt-6 bg-white py-8 px-4 shadow-xl border border-slate-100 sm:rounded-2xl sm:px-10">
          <div className="text-center space-y-2 mb-6">
            <h2 className="text-lg font-semibold text-slate-800">Entrar no Portal</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Clientes: e-mail e senha ou Google. Equipe BInsight: use @binsight.com.br com Google.
            </p>
          </div>

          {authError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-[11px] text-red-800 font-medium whitespace-pre-line leading-relaxed">
              {authError}
            </div>
          )}

          {usingMockData && onLoginAsDemo && (
            <div className="mb-5 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center">
                Modo demo (sem Google)
              </p>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => onLoginAsDemo('admin')}
                  className="h-10 rounded-xl border border-purple-200 bg-purple-50 text-purple-800 text-xs font-bold uppercase tracking-wide hover:bg-purple-100 transition"
                >
                  Entrar como Admin
                </button>
                <button
                  type="button"
                  onClick={() => onLoginAsDemo('financeiro')}
                  className="h-10 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-800 text-xs font-bold uppercase tracking-wide hover:bg-indigo-100 transition"
                >
                  Entrar como Financeiro
                </button>
                <button
                  type="button"
                  onClick={() => onLoginAsDemo('cliente')}
                  className="h-10 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-xs font-bold uppercase tracking-wide hover:bg-slate-100 transition"
                >
                  Entrar como Cliente demo
                </button>
              </div>
              <p className="text-[10px] text-center text-slate-400 pt-1">
                Ou use Google abaixo (requer domínio autorizado no Firebase)
              </p>
            </div>
          )}

          {showEmailLogin && (
            <form onSubmit={handleEmailLogin} className="space-y-3 mb-5">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-mail"
                autoComplete="username"
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5"
                required
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha"
                autoComplete="current-password"
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5"
                required
              />
              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full h-11 bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-xs tracking-wider uppercase rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoggingIn ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar com e-mail e senha'
                )}
              </button>
            </form>
          )}

          {showEmailLogin && (
            <div className="relative mb-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-white px-2 text-slate-400 font-bold tracking-wider">ou</span>
              </div>
            </div>
          )}

          <button
            onClick={onLogin}
            disabled={isLoggingIn}
            className="w-full h-11 bg-white border border-slate-300 text-slate-700 font-extrabold text-xs tracking-wider uppercase rounded-xl shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer"
          >
            {isLoggingIn && !showEmailLogin ? (
              <>
                <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                Conectando...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Entrar com Google
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
