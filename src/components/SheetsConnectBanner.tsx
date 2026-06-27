import { Loader2, Sheet } from 'lucide-react';

interface Props {
  onConnect: () => void;
  connecting: boolean;
  compact?: boolean;
}

export default function SheetsConnectBanner({ onConnect, connecting, compact }: Props) {
  if (compact) {
    return (
      <button
        type="button"
        onClick={onConnect}
        disabled={connecting}
        className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-bold text-[10px] uppercase tracking-wide py-1.5 px-3 rounded-lg transition"
      >
        {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sheet className="w-3.5 h-3.5" />}
        <span className="hidden sm:inline">Conectar planilhas</span>
        <span className="sm:hidden">Planilhas</span>
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-amber-900">Conecte o Google Sheets para ver e editar pedidos</p>
        <p className="text-xs text-amber-800 mt-0.5">
          Você já está logado no portal. Para acessar o Mapa de Vendas, autorize o Google uma vez — abre só
          este pop-up, sem pedir senha de novo se a sessão Google estiver ativa.
        </p>
      </div>
      <button
        type="button"
        onClick={onConnect}
        disabled={connecting}
        className="shrink-0 inline-flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-bold text-xs uppercase tracking-wide py-2.5 px-4 rounded-lg transition"
      >
        {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sheet className="w-4 h-4" />}
        Conectar planilhas
      </button>
    </div>
  );
}
