import { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fetchClientAccessRecords } from '../utils/clientAccess';
import { ClientAccessRecord } from '../types';

export default function AdminClientPreviewBar() {
  const { token, clientPreview, startClientPreview, stopClientPreview, canUseClientPreview } =
    useAuth();
  const [records, setRecords] = useState<ClientAccessRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(clientPreview?.email ?? '');
  const navigate = useNavigate();

  const load = useCallback(async () => {
    if (!token || !canUseClientPreview) return;
    setLoading(true);
    try {
      const all = await fetchClientAccessRecords(token);
      setRecords(all.filter((r) => r.status === 'ATIVO'));
    } finally {
      setLoading(false);
    }
  }, [token, canUseClientPreview]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSelected(clientPreview?.email ?? '');
  }, [clientPreview?.email]);

  if (!canUseClientPreview) return null;

  const handleStart = () => {
    const record = records.find((r) => r.email === selected);
    if (!record) return;
    startClientPreview(record);
    navigate('/pedidos');
  };

  return (
    <div className="bg-indigo-50 border-b border-indigo-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center gap-2 text-xs">
        <Eye className="w-4 h-4 text-indigo-600 shrink-0" />
        <span className="font-bold text-indigo-900 uppercase tracking-wide">Ver como cliente</span>
        {clientPreview ? (
          <>
            <span className="text-indigo-800">
              Visualizando: <strong>{clientPreview.nome}</strong> ({clientPreview.email})
            </span>
            <button
              type="button"
              onClick={() => {
                stopClientPreview();
                navigate('/admin/pedidos');
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-indigo-800 font-semibold hover:bg-indigo-100"
            >
              <EyeOff className="w-3.5 h-3.5" />
              Sair da visualização
            </button>
          </>
        ) : (
          <>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              disabled={loading || records.length === 0}
              className="min-w-[200px] max-w-xs text-sm border border-indigo-200 rounded-lg px-2 py-1.5 bg-white"
            >
              <option value="">Selecione um cliente ATIVO…</option>
              {records.map((r) => (
                <option key={r.email} value={r.email}>
                  {r.nome} — {r.email}
                </option>
              ))}
            </select>
            {loading && <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />}
            <button
              type="button"
              disabled={!selected}
              onClick={handleStart}
              className="px-3 py-1.5 rounded-lg bg-indigo-700 text-white font-bold uppercase tracking-wide disabled:opacity-50 hover:bg-indigo-800"
            >
              Abrir visão cliente
            </button>
          </>
        )}
      </div>
    </div>
  );
}
