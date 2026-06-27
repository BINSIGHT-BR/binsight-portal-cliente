import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, X } from 'lucide-react';
import { todayReviewDateBR } from '../utils/pedidoReviewQueue';

interface Props {
  remainingCount: number;
  totalCount: number;
  reviewedCount: number;
  reviewDate: string;
}

function dismissStorageKey(date: string): string {
  return `dailyReviewPopupDismissed_${date}`;
}

export default function DailyReviewPopup({
  remainingCount,
  totalCount,
  reviewedCount,
  reviewDate,
}: Props) {
  const [visible, setVisible] = useState(false);
  const today = todayReviewDateBR();

  useEffect(() => {
    if (reviewDate !== today) return;
    if (totalCount === 0) {
      setVisible(false);
      return;
    }
    const dismissed = sessionStorage.getItem(dismissStorageKey(today)) === '1';
    if (!dismissed && remainingCount > 0) {
      setVisible(true);
    }
    if (remainingCount === 0) {
      setVisible(false);
    }
  }, [remainingCount, totalCount, reviewDate, today]);

  const dismiss = () => {
    sessionStorage.setItem(dismissStorageKey(today), '1');
    setVisible(false);
  };

  if (!visible || totalCount === 0) return null;

  const pct = totalCount > 0 ? Math.round((reviewedCount / totalCount) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-labelledby="daily-review-title"
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
      >
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4 text-white flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <p id="daily-review-title" className="text-sm font-bold uppercase tracking-wide opacity-90">
                Revisão diária
              </p>
              <p className="text-2xl font-black tabular-nums">{remainingCount}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="p-1.5 rounded-lg hover:bg-white/20 transition"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-slate-600">
            <strong className="text-slate-900">{remainingCount}</strong> de{' '}
            <strong className="text-slate-900">{totalCount}</strong> pedidos com{' '}
            <span className="font-semibold">PENDENTE</span> ou <span className="font-semibold">RMA</span>{' '}
            ainda precisam de revisão hoje ({reviewDate}).
          </p>

          <div>
            <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400 mb-1">
              <span>Progresso do dia</span>
              <span>{reviewedCount}/{totalCount} ({pct}%)</span>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            O financeiro e o administrador veem os mesmos checks em tempo real. Amanhã a fila reinicia
            automaticamente.
          </p>

          <div className="flex gap-2">
            <Link
              to="/admin/revisao"
              onClick={dismiss}
              className="flex-1 text-center py-2.5 px-4 text-xs font-bold uppercase tracking-wide text-white bg-purple-700 hover:bg-purple-800 rounded-xl transition"
            >
              Ir para revisão
            </Link>
            <button
              type="button"
              onClick={dismiss}
              className="py-2.5 px-4 text-xs font-bold uppercase tracking-wide text-slate-500 hover:bg-slate-100 rounded-xl transition"
            >
              Depois
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
