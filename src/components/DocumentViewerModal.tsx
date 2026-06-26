import { useEffect, useState } from 'react';
import { Download, Loader2, X } from 'lucide-react';
import {
  canPreviewMime,
  downloadBlob,
  fetchDriveFileForView,
  type DriveFileView,
} from '../utils/driveDocumentView';

interface Props {
  open: boolean;
  title: string;
  driveUrl: string;
  accessToken: string;
  userEmail?: string;
  onClose: () => void;
}

export default function DocumentViewerModal({
  open,
  title,
  driveUrl,
  accessToken,
  userEmail,
  onClose,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<DriveFileView | null>(null);

  useEffect(() => {
    if (!open) {
      setFile((prev) => {
        if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
        return null;
      });
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchDriveFileForView(accessToken, driveUrl)
      .then((view) => {
        if (!cancelled) setFile(view);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao abrir documento.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, driveUrl, accessToken]);

  useEffect(() => {
    return () => {
      if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl);
    };
  }, [file?.previewUrl]);

  if (!open) return null;

  const handleDownload = () => {
    if (!file) return;
    downloadBlob(file.blob, file.name);
  };

  const showPreview = file && canPreviewMime(file.mimeType);

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
      <div className="bg-white w-full sm:max-w-3xl max-h-[92vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-sm font-bold text-slate-800">{title}</h3>
            {userEmail && (
              <p className="text-[10px] text-slate-400 mt-0.5">
                Acesso via {userEmail}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!file || loading}
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" />
              Baixar
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-[50vh] sm:min-h-[420px] bg-slate-100 relative">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              <p className="text-xs">Carregando documento…</p>
            </div>
          )}

          {error && !loading && (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="max-w-sm text-center rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-800">{error}</p>
                {userEmail && (
                  <p className="text-[11px] text-red-700/80 mt-2">
                    Confirme que você entrou com <strong>{userEmail}</strong> — o mesmo e-mail aprovado
                    no cadastro BInsight.
                  </p>
                )}
              </div>
            </div>
          )}

          {showPreview && file && !loading && (
            <>
              {file.mimeType.includes('pdf') && (
                <iframe
                  title={title}
                  src={file.previewUrl}
                  className="w-full h-full min-h-[50vh] sm:min-h-[420px] border-0 bg-white"
                />
              )}
              {file.mimeType.startsWith('image/') && (
                <div className="flex items-center justify-center h-full min-h-[50vh] p-4 overflow-auto">
                  <img src={file.previewUrl} alt={title} className="max-w-full max-h-[70vh] object-contain" />
                </div>
              )}
              {!file.mimeType.includes('pdf') && !file.mimeType.startsWith('image/') && (
                <div className="flex flex-col items-center justify-center h-full min-h-[50vh] p-6 text-center">
                  <p className="text-sm text-slate-600">
                    Visualização inline não disponível para este tipo de arquivo.
                  </p>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-purple-700 rounded-lg"
                  >
                    <Download className="w-4 h-4" />
                    Baixar {file.name}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
