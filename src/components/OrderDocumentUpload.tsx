import { useRef, useState } from 'react';
import { FileText, Loader2, Upload } from 'lucide-react';
import { PedidoMapa } from '../types';
import { USE_MOCK_DATA, USE_OAUTH_SHEETS } from '../constants/columns';
import { uploadAndLinkOrderDocument } from '../utils/orderDocuments';
import { resolveClientDocEmails } from '../utils/clientDocAccess';
import { uploadNfViaApi } from '../utils/clienteApi';

interface Props {
  pedido: PedidoMapa;
  accessToken: string;
  userEmail: string;
  onUpdated: (pedido: PedidoMapa) => void;
}

export default function OrderDocumentUpload({ pedido, accessToken, userEmail, onUpdated }: Props) {
  const nfRef = useRef<HTMLInputElement>(null);
  const boletoRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<'nf' | 'boleto' | null>(null);
  const [sharePreview, setSharePreview] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canUpload = !USE_MOCK_DATA && (USE_OAUTH_SHEETS || !USE_OAUTH_SHEETS);

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
    setUploading(kind);
    setError(null);
    try {
      if (USE_OAUTH_SHEETS) {
        const updated = await uploadAndLinkOrderDocument(
          accessToken,
          kind,
          file,
          pedido,
          userEmail
        );
        onUpdated(updated);
        void loadSharePreview();
      } else {
        if (kind !== 'nf') throw new Error('Boleto via API ainda não disponível.');
        await uploadNfViaApi(pedido.rowNum, file);
        onUpdated({ ...pedido, hasNfFile: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro no upload.');
    } finally {
      setUploading(null);
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
            : 'Nenhum e-mail ATIVO para este CNPJ — aprove em Acessos Clientes.'}
        </p>
      )}

      {error && <p className="text-[10px] text-red-600">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <DocSlot
          label="Nota Fiscal (col AC)"
          link={pedido.nfDriveUrl}
          uploading={uploading === 'nf'}
          onPick={() => nfRef.current?.click()}
        />
        <DocSlot
          label="Boleto (col AD)"
          link={pedido.boletoDriveUrl}
          uploading={uploading === 'boleto'}
          onPick={() => boletoRef.current?.click()}
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
          Após o envio, o cliente visualiza NF e boleto em pop-up no portal (sem ver o link do Drive).
          Compartilhamento automático com os e-mails ATIVOS abaixo — o cliente deve entrar com o mesmo
          Google cadastrado.
        </p>
      )}
    </div>
  );
}

function DocSlot({
  label,
  link,
  uploading,
  onPick,
}: {
  label: string;
  link?: string;
  uploading: boolean;
  onPick: () => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
      <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
      {link ? (
        <p className="text-[10px] text-green-700 font-semibold flex items-center gap-1">
          <FileText className="w-3.5 h-3.5" /> Disponível ao cliente
        </p>
      ) : (
        <p className="text-[10px] text-slate-400 flex items-center gap-1">
          <FileText className="w-3.5 h-3.5" /> Pendente
        </p>
      )}
      <button
        type="button"
        disabled={uploading}
        onClick={onPick}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold uppercase text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg disabled:opacity-50"
      >
        {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
        {link ? 'Substituir' : 'Enviar'}
      </button>
    </div>
  );
}
