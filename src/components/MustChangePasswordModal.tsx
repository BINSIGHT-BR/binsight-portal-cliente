import { FormEvent, useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { changeSheetPassword } from '../utils/connectPortalApi';

export default function MustChangePasswordModal() {
  const { mustChangePassword, authProvider, token, clearMustChangePassword, refreshProfile } =
    useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!mustChangePassword || authProvider !== 'sheet' || !token) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Use pelo menos 6 caracteres.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await changeSheetPassword(token, '', newPassword);
      await refreshProfile();
      clearMustChangePassword();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao alterar senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-start gap-3">
          <KeyRound className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-lg font-bold text-slate-800">Defina sua nova senha</h2>
            <p className="text-sm text-slate-500 mt-1">
              Sua senha temporária precisa ser trocada antes de continuar no portal.
            </p>
          </div>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nova senha"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5"
            autoComplete="new-password"
            required
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirmar nova senha"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5"
            autoComplete="new-password"
            required
          />
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || !newPassword}
            className="w-full h-11 bg-purple-700 hover:bg-purple-800 text-white text-sm font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Salvar e continuar
          </button>
        </form>
      </div>
    </div>
  );
}
