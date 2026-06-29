import { useRef, useState } from 'react';
import { FileText, Loader2, Trash2, Upload } from 'lucide-react';
import { PedidoMapa } from '../types';
import { USE_MOCK_DATA, USE_OAUTH_SHEETS } from '../constants/columns';
import { removeAndUnlinkOrderDocument, uploadAndLinkOrderDocument } from '../utils/orderDocuments';
import { resolveClientDocEmails } from '../utils/clientDocAccess';
import { deleteNfViaApi, updatePedidoViaApi, uploadNfViaApi } from '../utils/clienteApi';

interface Props {
  pedido: PedidoMapa;
  accessToken: string;
  userEmail: string;
  onUpdated: (pedido: PedidoMapa) => void;
}

export default function OrderDocumentUpload({ pedido, accessToken, userEmail, onUpdated }: Props) {
  const nfRef = useRef<HTMLInputElement>(null);
  const boletoRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'nf' | 'boleto' | null>(null);
  const [busyAction, setBusyAction] = useState<'upload' | 'remove' | null>(null);
  const [sharePreview, setSharePreview] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const canUpload = !USE_MOCK_DATA && (USE_OAUTH_SHEETS || !USE_OAUTH_SHEETS);

  const hasNf = Boolean(pedido.nfDriveUrl?.trim()) || Boolean(pedido.hasNfFile);
  const hasBoleto = Boolean(pedido.boletoDriveUrl?.trim());

  const loadSharePreview = async () => {
    if (USE_MOCK_DATA || !USE_OAUTH_SHEETS) return;
    try {
      const emails = await resolveClientDocEmails(accessToken, pedido.cnpj);
      setSharePreview(emails);
    } catch {
      setSharePreview([]);
    }
  };

  const handleUpload = async (kind: 'nf' | 'boleto', files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];
    setBusy(kind);
    setBusyAction('upload');
    setError(null);
    setSuccessMsg(null);
    setInfoMsg(null);
    try {
      if (USE_OAUTH_SHEETS) {
        const { pedido: updated, notify } = await uploadAndLinkOrderDocument(
          accessToken,
          kind,
          file,
          pedido,
          userEmail
        );
        onUpdated(updated);
        setSuccessMsg('Documento salvo na planilha e no Drive.');
        if (notify.emailed.length) {
          setSuccessMsg(`Documento salvo. E-mail enviado para: ${notify.emailed.join(', ')}`);
        } else if (notify.noPortalClient) {
          setInfoMsg(
            notify.skippedReason ??
              'Cliente ainda não cadastrado no portal — verá após aprovação. E-mail não enviado.'
          );
        } else if (notify.skippedReason) {
          setInfoMsg(`E-mail não enviado: ${notify.skippedReason}`);
        }
        void loadSharePreview();
      } else {
        if (kind !== 'nf') throw new Error('Boleto via API ainda não disponível.');
        await uploadNfViaApi(pedido.rowNum, file);
        onUpdated({ ...pedido, hasNfFile: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro no upload.');
    } finally {
      setBusy(null);
      setBusyAction(null);
    }
  };

  const handleRemove = async (kind: 'nf' | 'boleto') => {
    const label = kind === 'nf' ? 'Nota Fiscal' : 'Boleto';
    const hasDoc = kind === 'nf' ? hasNf : hasBoleto;
    if (!hasDoc) return;

    const ok = window.confirm(
      `Remover a ${label} deste pedido?\n\nO cliente deixará de visualizar o documento no portal. O arquivo no Drive será movido para a lixeira quando possível.`
    );
    if (!ok) return;

    setBusy(kind);
    setBusyAction('remove');
    setError(null);
    try {
      if (USE_OAUTH_SHEETS) {
        const updated = await removeAndUnlinkOrderDocument(
          accessToken,
          kind,
          pedido,
          userEmail
        );
        onUpdated(updated);
      } else {
        if (kind === 'nf') {
          if (pedido.hasNfFile) await deleteNfViaApi(pedido.rowNum);
          if (pedido.nfDriveUrl?.trim()) {
            await updatePedidoViaApi(pedido.rowNum, { nfDriveUrl: '' });
          }
          onUpdated({ ...pedido, nfDriveUrl: '', hasNfFile: false });
        } else {
          if (pedido.boletoDriveUrl?.trim()) {
            await updatePedidoViaApi(pedido.rowNum, { boletoDriveUrl: '' });
          }
          onUpdated({ ...pedido, boletoDriveUrl: '' });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover documento.');
    } finally {
      setBusy(null);
      setBusyAction(null);
    }
  };

  if (USE_MOCK_DATA) {
    return (
      <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded-lg p-3">
        Upload NF/boleto disponível com login Google (modo OAuth).
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-purple-100 bg-purple-50/40 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-slate-800">NF e boleto no Drive</p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Pasta: BInsight Connect / Clientes / {pedido.cnpj.replace(/\D/g, '').slice(0, 14)} / ano / mês
          </p>
        </div>
        {USE_OAUTH_SHEETS && (
          <button
            type="button"
            onClick={() => void loadSharePreview()}
            className="text-[10px] font-bold text-purple-700 underline shrink-0"
          >
            Ver e-mails com acesso
          </button>
        )}
      </div>

      {sharePreview && (
        <p className="text-[10px] text-slate-600">
          {sharePreview.length
            ? `Compartilhado com: ${sharePreview.join(', ')}`
            : 'Nenhum cliente ATIVO no portal para este CNPJ — upload permitido; cliente verá após cadastro aprovado.'}
        </p>
      )}

      {error && <p className="text-[10px] text-red-600">{error}</p>}
      {successMsg && <p className="text-[10px] text-green-700 font-medium">{successMsg}</p>}
      {infoMsg && <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">{infoMsg}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <DocSlot
          label="Nota Fiscal (col AC)"
          available={hasNf}
          busy={busy === 'nf'}
          busyAction={busy === 'nf' ? busyAction : null}
          onPick={() => nfRef.current?.click()}
          onRemove={() => void handleRemove('nf')}
        />
        <DocSlot
          label="Boleto (col AD)"
          available={hasBoleto}
          busy={busy === 'boleto'}
          busyAction={busy === 'boleto' ? busyAction : null}
          onPick={() => boletoRef.current?.click()}
          onRemove={() => void handleRemove('boleto')}
        />
      </div>

      <input
        ref={nfRef}
        type="file"
        accept=".pdf,.xml,application/pdf,application/xml,image/*"
        className="hidden"
        onChange={(e) => void handleUpload('nf', e.target.files)}
      />
      <input
        ref={boletoRef}
        type="file"
        accept=".pdf,.xml,application/pdf,application/xml,image/*"
        className="hidden"
        onChange={(e) => void handleUpload('boleto', e.target.files)}
      />

      {canUpload && USE_OAUTH_SHEETS && (
        <p className="text-[10px] text-slate-500">
          Pode enviar NF/boleto mesmo sem cadastro no portal — o link fica na planilha (cols AC/AD).
          O cliente só visualiza após aprovação em Acessos. E-mail automático só se ATIVO + Notificar = Sim.
        </p>
      )}
    </div>
  );
}

function DocSlot({
  label,
  available,
  busy,
  busyAction,
  onPick,
  onRemove,
}: {
  label: string;
  available: boolean;
  busy: boolean;
  busyAction: 'upload' | 'remove' | null;
  onPick: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
      <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
      {available ? (
        <p className="text-[10px] text-green-700 font-semibold flex items-center gap-1">
          <FileText className="w-3.5 h-3.5" /> Disponível ao cliente
        </p>
      ) : (
        <p className="text-[10px] text-slate-400 flex items-center gap-1">
          <FileText className="w-3.5 h-3.5" /> Pendente
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onPick}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold uppercase text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg disabled:opacity-50"
        >
          {busy && busyAction === 'upload' ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Upload className="w-3 h-3" />
          )}
          {available ? 'Substituir' : 'Enviar'}
        </button>
        {available && (
          <button
            type="button"
            disabled={busy}
            onClick={onRemove}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold uppercase text-red-700 bg-red-50 hover:bg-red-100 rounded-lg disabled:opacity-50"
          >
            {busy && busyAction === 'remove' ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Trash2 className="w-3 h-3" />
            )}
            Remover
          </button>
        )}
      </div>
    </div>
  );
}
