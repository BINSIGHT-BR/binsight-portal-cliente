import { FormEvent, useState } from 'react';
import { Bell, Loader2, UserPlus } from 'lucide-react';
import CnpjListFields from './CnpjListFields';
import { validateCnpjInputs } from '../utils/cnpjList';

export interface PublicRegisterPayload {
  email: string;
  password: string;
  nomeContato: string;
  sobrenomeContato: string;
  /** CNPJ principal (col C). */
  cnpj: string;
  /** CNPJs extras (col G). */
  additionalCnpjs: string[];
  /** Todos os CNPJs normalizados. */
  cnpjs: string[];
  notifyEmail: boolean;
}

interface Props {
  onSubmit: (payload: PublicRegisterPayload) => Promise<void>;
  isSubmitting?: boolean;
  error?: string | null;
}

const inputCls =
  'w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-purple-500 focus:border-transparent';

export default function PublicRegisterForm({ onSubmit, isSubmitting, error }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [cnpjValues, setCnpjValues] = useState(['']);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (password.length < 6) {
      setLocalError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('As senhas não coincidem.');
      return;
    }
    const cnpjCheck = validateCnpjInputs(cnpjValues);
    if (!cnpjCheck.ok) {
      setLocalError(cnpjCheck.error);
      return;
    }
    await onSubmit({
      email: email.trim(),
      password,
      nomeContato: firstName.trim(),
      sobrenomeContato: lastName.trim(),
      cnpj: cnpjCheck.primary,
      additionalCnpjs: cnpjCheck.additional,
      cnpjs: cnpjCheck.all,
      notifyEmail,
    });
  };

  const displayError = localError || error;

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
      {displayError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 whitespace-pre-line">
          {displayError}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Nome</label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="João"
            required
            className={inputCls}
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
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">E-mail</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@empresa.com.br"
          autoComplete="email"
          required
          className={inputCls}
        />
      </div>

      <CnpjListFields
        values={cnpjValues}
        onChange={setCnpjValues}
        inputCls={inputCls}
        hint="Use o botão + para cadastrar filiais ou CNPJs adicionais da mesma conta."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mín. 6 caracteres"
            autoComplete="new-password"
            required
            minLength={6}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Confirmar senha</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repita a senha"
            autoComplete="new-password"
            required
            minLength={6}
            className={inputCls}
          />
        </div>
      </div>

      <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-slate-100 bg-slate-50/80 p-3">
        <input
          type="checkbox"
          checked={notifyEmail}
          onChange={(e) => setNotifyEmail(e.target.checked)}
          className="mt-0.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
        />
        <span className="text-xs text-slate-600 leading-relaxed">
          <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
            <Bell className="w-3.5 h-3.5 text-purple-600" />
            Receber e-mails de atualização
          </span>
        </span>
      </label>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full h-11 bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-xs tracking-wider uppercase rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Enviando...
          </>
        ) : (
          <>
            <UserPlus className="w-4 h-4" />
            Solicitar acesso
          </>
        )}
      </button>

      <p className="text-[11px] text-center text-slate-400 leading-relaxed">
        Seu cadastro ficará <strong className="text-amber-700">PENDENTE</strong> até o financeiro aprovar.
        Você receberá e-mail quando o acesso for liberado.
      </p>
    </form>
  );
}
