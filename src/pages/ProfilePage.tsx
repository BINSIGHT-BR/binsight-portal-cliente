import { FormEvent, useEffect, useState } from 'react';
import { Bell, BellOff, KeyRound, Loader2, Save } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { updateNotifyPreference } from '../utils/clientAccess';
import { USE_MOCK_DATA, USE_OAUTH_SHEETS } from '../constants/columns';
import { changeSheetPassword } from '../utils/connectPortalApi';
import {
  changePortalPassword,
  sendPortalPasswordResetEmail,
} from '../utils/firebase';

export default function ProfilePage() {
  const { portalUser, token, clientStatus, refreshProfile, authProvider } = useAuth();
  const [notifyEmail, setNotifyEmail] = useState(portalUser?.notifyEmail !== false);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const isSheetAuth = authProvider === 'sheet';
  const mockHint = USE_MOCK_DATA || (!USE_OAUTH_SHEETS && !isSheetAuth);

  useEffect(() => {
    setNotifyEmail(portalUser?.notifyEmail !== false);
  }, [portalUser?.notifyEmail]);

  if (!portalUser) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      await updateNotifyPreference(token, portalUser.email, notifyEmail);
      await refreshProfile();
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar preferências.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetLink = async () => {
    setPwdLoading(true);
    setPwdMsg(null);
    setError(null);
    try {
      await sendPortalPasswordResetEmail(portalUser.email);
      setPwdMsg('Enviamos um link para redefinir/definir sua senha no e-mail cadastrado.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar link.');
    } finally {
      setPwdLoading(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    setPwdLoading(true);
    setPwdMsg(null);
    setError(null);
    try {
      if (isSheetAuth && token) {
        await changeSheetPassword(token, oldPassword, newPassword);
      } else {
        await changePortalPassword(newPassword);
      }
      setPwdMsg('Senha alterada com sucesso.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao alterar senha.');
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Meu perfil</h1>
        <p className="text-sm text-slate-500 mt-1">
          Dados da sua conta no BInsight Connect.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <p className="text-[10px] font-bold uppercase text-slate-400">Nome</p>
          <p className="text-sm font-medium text-slate-800">{portalUser.displayName}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase text-slate-400">E-mail</p>
          <p className="text-sm font-medium text-slate-800">{portalUser.email}</p>
        </div>
        {portalUser.cnpjs.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400">CNPJs liberados</p>
            <p className="text-sm font-mono text-slate-700">{portalUser.cnpjs.join(', ')}</p>
          </div>
        )}
      </div>

      {portalUser.role === 'cliente' && (
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4"
        >
          <div className="flex items-start gap-3">
            {notifyEmail ? (
              <Bell className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
            ) : (
              <BellOff className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
            )}
            <div>
              <h2 className="text-sm font-bold text-slate-800">Notificações por e-mail</h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Receber avisos de <strong>financeiro@binsight.com.br</strong> quando houver
                atualização de status do pedido, observação da equipe, pagamento, NF ou boleto
                disponível no portal.
              </p>
            </div>
          </div>

          <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-slate-100 bg-slate-50/80 p-4">
            <input
              type="checkbox"
              checked={notifyEmail}
              onChange={(e) => {
                setNotifyEmail(e.target.checked);
                setSaved(false);
              }}
              disabled={mockHint}
              className="mt-0.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm text-slate-700">
              Quero receber e-mails de atualização dos meus pedidos
            </span>
          </label>

          {mockHint && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3">
              Preferências disponíveis apenas com login ativo (Google ou e-mail/senha em produção).
            </p>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </div>
          )}

          {saved && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-700">
              Preferência salva.
            </div>
          )}

          <button
            type="submit"
            disabled={loading || mockHint}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-700 hover:bg-purple-800 text-white text-sm font-bold rounded-xl disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar
          </button>
        </form>
      )}

      {portalUser.role === 'cliente' && !mockHint && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-start gap-3">
            <KeyRound className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-slate-800">Senha do portal</h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {isSheetAuth
                  ? 'Você entrou com e-mail e senha. Altere abaixo ou peça uma nova senha temporária ao financeiro.'
                  : 'Login principal com Google. Também é possível definir senha alternativa no Firebase, se habilitado.'}
              </p>
            </div>
          </div>
          {!isSheetAuth && (
            <button
              type="button"
              disabled={pwdLoading}
              onClick={() => void handleSendResetLink()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-bold rounded-xl disabled:opacity-50"
            >
              {pwdLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              Enviar link por e-mail (Firebase)
            </button>
          )}
          <form onSubmit={(e) => void handleChangePassword(e)} className="space-y-3 pt-2 border-t border-slate-100">
            <p className="text-[10px] font-bold uppercase text-slate-400">Alterar senha</p>
            {isSheetAuth && (
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Senha atual"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                autoComplete="current-password"
              />
            )}
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nova senha"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
              autoComplete="new-password"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirmar nova senha"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
              autoComplete="new-password"
            />
            <button
              type="submit"
              disabled={pwdLoading || !newPassword || (isSheetAuth && !oldPassword)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-purple-700 bg-purple-50 rounded-lg disabled:opacity-50"
            >
              Salvar nova senha
            </button>
          </form>
          {pwdMsg && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-700">
              {pwdMsg}
            </div>
          )}
        </div>
      )}

      {clientStatus === 'pendente' && (
        <Link
          to="/aguardando"
          className="inline-block text-sm text-purple-700 hover:text-purple-900 font-semibold"
        >
          ← Voltar para aguardando aprovação
        </Link>
      )}
    </div>
  );
}
