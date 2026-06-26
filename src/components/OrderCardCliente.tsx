import { useState } from 'react';
import { ChevronDown, ChevronUp, Download, Eye, FileText, Loader2, MessageSquare, Package, Receipt } from 'lucide-react';
import { PedidoCliente } from '../types';
import { fmtBRL } from '../utils/orders';
import { formatVencimentosResumo } from '../utils/orderFilters';
import { getStagesForPedido } from '../utils/timeline';
import OrderTimeline from './OrderTimeline';
import DocumentViewerModal from './DocumentViewerModal';
import { updateOrderRow } from '../utils/orders';
import { downloadNfFromApi, triggerFileDownload } from '../utils/clienteApi';
import { USE_MOCK_DATA, USE_OAUTH_SHEETS } from '../constants/columns';
import { PedidoMapa } from '../types';

interface Props {
  pedido: PedidoCliente;
  accessToken?: string;
  userEmail?: string;
  onUpdated?: () => void;
}

function ObsBadge({ label }: { label: string }) {
  if (!label.trim()) return null;
  const l = label.toLowerCase();
  let cls = 'bg-slate-100 text-slate-600';
  if (l.includes('pendente de nf')) cls = 'bg-amber-100 text-amber-800';
  else if (l.includes('processo de entrega') || l.includes('rota')) cls = 'bg-indigo-100 text-indigo-700';
  else if (l.includes('entregue') || l.includes('licença') || l.includes('licenca'))
    cls = 'bg-green-100 text-green-700';
  else if (l.includes('cancelado')) cls = 'bg-red-100 text-red-700';
  else if (l.includes('faturado')) cls = 'bg-blue-100 text-blue-700';

  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

type DocKind = 'nf' | 'boleto';

export default function OrderCardCliente({ pedido: p, accessToken, userEmail, onUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [docView, setDocView] = useState<{ kind: DocKind; url: string } | null>(null);
  const [obsInput, setObsInput] = useState(p.observacaoCliente ?? '');
  const [savingObs, setSavingObs] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const { stages, current, completed } = getStagesForPedido(p);
  const vencResumo = formatVencimentosResumo(p);

  const handleDownloadNf = async () => {
    if (!p.rowNum || USE_MOCK_DATA) return;
    setDownloading(true);
    try {
      const { fileName, dataUrl } = await downloadNfFromApi(p.rowNum);
      triggerFileDownload(dataUrl, fileName);
    } catch (err) {
      setDocError(err instanceof Error ? err.message : 'NF indisponível.');
    } finally {
      setDownloading(false);
    }
  };

  const openDocument = (kind: DocKind, url?: string) => {
    if (!url || !accessToken) return;
    setDocError(null);
    setDocView({ kind, url });
  };

  const handleSaveObs = async () => {
    if (!p.rowNum || USE_MOCK_DATA || !accessToken) return;
    setSavingObs(true);
    setDocError(null);
    try {
      if (USE_OAUTH_SHEETS) {
        await updateOrderRow(accessToken, {
          rowNum: p.rowNum,
          observacaoCliente: obsInput,
        } as PedidoMapa, userEmail, true);
      } else {
        const { updatePedidoViaApi } = await import('../utils/clienteApi');
        await updatePedidoViaApi(p.rowNum, { observacaoCliente: obsInput });
      }
      onUpdated?.();
    } catch (err) {
      setDocError(err instanceof Error ? err.message : 'Erro ao salvar observação.');
    } finally {
      setSavingObs(false);
    }
  };

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
        <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono text-slate-400">{p.data || '—'}</span>
              {p.mapaYear && (
                <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                  {p.mapaYear}
                </span>
              )}
              {p.numPedidoCli && (
                <span className="text-[10px] font-mono bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">
                  Pedido {p.numPedidoCli}
                </span>
              )}
              {p.mapaKind === 'assinatura' && (
                <span className="text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">
                  Assinatura
                </span>
              )}
            </div>
            <div className="mt-2 flex items-start gap-2">
              <Package className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <p className="text-sm font-semibold text-slate-800 leading-snug">{p.descricaoProduto}</p>
            </div>
          </div>
          <button
            onClick={() => setOpen((o) => !o)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition shrink-0"
          >
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        <div className="px-4 pb-3 flex flex-wrap items-center gap-2">
          <ObsBadge label={p.obsCliente || p.status} />
          {vencResumo && (
            <span className="text-[10px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded">
              {vencResumo}
            </span>
          )}
        </div>

        <div className="px-4 pb-4 border-b border-slate-100">
          <OrderTimeline stages={stages} current={current} completed={completed} compact />
        </div>

        <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Valor</p>
            <p className="text-sm font-bold text-slate-800">{fmtBRL(p.vendaTotal)}</p>
          </div>

          {USE_OAUTH_SHEETS ? (
            <div className="flex flex-wrap gap-2 justify-end">
              {p.nfDriveUrl && accessToken && (
                <button
                  type="button"
                  onClick={() => openDocument('nf', p.nfDriveUrl)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Ver NF
                </button>
              )}
              {p.boletoDriveUrl && accessToken && (
                <button
                  type="button"
                  onClick={() => openDocument('boleto', p.boletoDriveUrl)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  Ver boleto
                </button>
              )}
              {!p.nfDriveUrl && !p.boletoDriveUrl && p.numNF ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                  <FileText className="w-3.5 h-3.5" />
                  NF {p.numNF}
                </span>
              ) : null}
            </div>
          ) : p.hasNfFile ? (
            <button
              type="button"
              onClick={() => void handleDownloadNf()}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg disabled:opacity-50"
            >
              {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Baixar NF
            </button>
          ) : p.numNF ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
              <FileText className="w-3.5 h-3.5" />
              NF em processamento
            </span>
          ) : null}
        </div>

        {docError && (
          <div className="px-4 pb-3">
            <p className="text-[10px] text-red-600">{docError}</p>
          </div>
        )}

        {open && (
          <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/60 space-y-3">
            {p.mapaKind === 'assinatura' && (
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                {p.periodicidade && (
                  <div>
                    <p className="text-[9px] font-bold uppercase text-slate-400">Periodicidade</p>
                    <p className="text-slate-600">{p.periodicidade}</p>
                  </div>
                )}
                {(p.vencimento || p.parc1) && (
                  <div>
                    <p className="text-[9px] font-bold uppercase text-slate-400">Vencimento</p>
                    <p className="text-slate-600">{p.vencimento || p.parc1}</p>
                  </div>
                )}
              </div>
            )}
            {p.mapaKind !== 'assinatura' && [p.parc1, p.parc2, p.parc3, p.parc4].some(Boolean) && (
              <div>
                <p className="text-[9px] font-bold uppercase text-slate-400 mb-1">Vencimentos</p>
                <ul className="text-[11px] text-slate-600 space-y-0.5">
                  {p.parc1 && <li>1ª parcela: {p.parc1}</li>}
                  {p.parc2 && <li>2ª parcela: {p.parc2}</li>}
                  {p.parc3 && <li>3ª parcela: {p.parc3}</li>}
                  {p.parc4 && <li>4ª parcela: {p.parc4}</li>}
                </ul>
              </div>
            )}

            {p.obsCliente && (
              <div>
                <p className="text-[9px] font-bold uppercase text-slate-400 mb-1">Atualização BInsight</p>
                <p className="text-[11px] text-slate-600 leading-relaxed">{p.obsCliente}</p>
              </div>
            )}

            {!USE_MOCK_DATA && !USE_OAUTH_SHEETS && p.rowNum && (
              <div>
                <p className="text-[9px] font-bold uppercase text-slate-400 mb-1 flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" /> Sua observação (opcional)
                </p>
                <textarea
                  value={obsInput}
                  onChange={(e) => setObsInput(e.target.value)}
                  rows={2}
                  placeholder="Dúvidas, referências de entrega, etc."
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                />
                <button
                  type="button"
                  onClick={() => void handleSaveObs()}
                  disabled={savingObs}
                  className="mt-2 px-3 py-1.5 text-[10px] font-bold text-purple-700 bg-purple-50 rounded-lg disabled:opacity-50"
                >
                  {savingObs ? 'Salvando…' : 'Salvar observação'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {docView && accessToken && (
        <DocumentViewerModal
          open
          title={docView.kind === 'nf' ? 'Nota Fiscal' : 'Boleto'}
          driveUrl={docView.url}
          accessToken={accessToken}
          userEmail={userEmail}
          onClose={() => setDocView(null)}
        />
      )}
    </>
  );
}
