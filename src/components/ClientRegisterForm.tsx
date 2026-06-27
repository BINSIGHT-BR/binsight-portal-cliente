import { FormEvent, useMemo, useState } from 'react';
import { Bell, Loader2, Send } from 'lucide-react';
import CnpjListFields from './CnpjListFields';
import { requestClientAccess } from '../utils/clientAccess';
import { USE_OAUTH_SHEETS } from '../constants/columns';
import { validateCnpjInputs } from '../utils/cnpjList';

interface Props {
  accessToken: string;
  email: string;
  displayName: string;
  googleFirstAccess?: boolean;
  onRegistered?: () => void | Promise<void>;
}

function splitDisplayName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: parts[0] ?? '', last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

export default function ClientRegisterForm({
  accessToken,
  email,
  displayName,
  googleFirstAccess = false,
  onRegistered,
}: Props) {
  const initial = useMemo(() => splitDisplayName(displayName), [displayName]);
  const [firstName, setFirstName] = useState(initial.first);
  const [lastName, setLastName] = useState(initial.last);
  const [cnpjValues, setCnpjValues] = useState(['']);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const cnpjCheck = validateCnpjInputs(cnpjValues);
      if (!cnpjCheck.ok) {
        setError(cnpjCheck.error);
        return;
      }
      const nome = `${firstName.trim()} ${lastName.trim()}`.trim();
      await requestClientAccess(accessToken, email, nome, cnpjCheck.primary, notifyEmail, {
        nomeContato: firstName.trim(),
        sobrenomeContato: lastName.trim(),
        additionalCnpjs: cnpjCheck.additional,
      });
      setSuccess(true);
      await onRegistered?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao solicitar acesso.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-md mx-auto text-center py-12 px-4">
        <div className="bg-green-50 border border-green-200 rounded-2xl p-8">
          <h2 className="text-lg font-bold text-green-800">Solicitação enviada</h2>
          <p className="text-sm text-green-700 mt-2 leading-relaxed">
            Seu cadastro foi registrado com status <strong>PENDENTE</strong>. A equipe BInsight validará
            os CNPJs informados e liberará o acesso em breve. O financeiro foi notificado por e-mail.
          </p>
          {USE_OAUTH_SHEETS && (
            <p className="text-xs text-green-700/80 mt-3">
              Você será direcionado para a tela de aguardando aprovação. Use o botão &quot;Verificar
              status&quot; se já tiver sido aprovado.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800">
          {googleFirstAccess ? 'Complete seu cadastro' : 'Solicitar acesso'}
        </h2>
        <p className="text-sm text-slate-500 mt-1 mb-6">
          {googleFirstAccess
            ? 'Seu Google foi autenticado com sucesso. Informe seu nome e os CNPJs da empresa — a equipe BInsight validará seu acesso.'
            : 'Informe seus dados e os CNPJs da empresa para acompanhar pedidos. Use o botão + para filiais adicionais.'}
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">E-mail</label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 text-slate-500"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Nome</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="João"
                required
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Sobrenome</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Silva"
                required
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
          <CnpjListFields values={cnpjValues} onChange={setCnpjValues} />
          <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-slate-100 bg-slate-50/80 p-4">
            <input
              type="checkbox"
              checked={notifyEmail}
              onChange={(e) => setNotifyEmail(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm text-slate-600 leading-relaxed">
              <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                <Bell className="w-3.5 h-3.5 text-purple-600" />
                Receber e-mails de atualização
              </span>
              <br />
              Avisos de status, NF e boleto enviados por financeiro@binsight.com.br. Você pode alterar
              isso depois em <strong>Meu perfil</strong>.
            </span>
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-purple-700 hover:bg-purple-800 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar solicitação
          </button>
        </form>
      </div>
    </div>
  );
}
