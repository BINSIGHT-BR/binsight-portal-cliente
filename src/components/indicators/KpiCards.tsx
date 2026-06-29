import type { IndicatorKpis } from '../../utils/orderIndicators';

interface Props {
  kpis: IndicatorKpis;
}

export default function KpiCards({ kpis }: Props) {
  const cards = [
    { label: 'Vendas (período)', value: String(kpis.totalVendas), accent: 'text-slate-800' },
    { label: 'Pendentes', value: String(kpis.pendentes), accent: 'text-amber-700' },
    { label: 'Faturados', value: String(kpis.faturados), accent: 'text-blue-700' },
    { label: 'Entregues', value: String(kpis.entregues), accent: 'text-green-700' },
    { label: 'Cancelados', value: String(kpis.cancelados), accent: 'text-red-700' },
    { label: 'RMA', value: String(kpis.rma), accent: 'text-purple-700' },
    { label: 'Pgto vencido', value: String(kpis.pagamentoVencido), accent: 'text-red-600' },
    { label: 'NF pend. 3+ dias', value: String(kpis.nfPendente3d), accent: 'text-amber-600' },
  ];

  if (kpis.semData > 0) {
    cards.push({
      label: 'Sem data válida',
      value: String(kpis.semData),
      accent: 'text-slate-500',
    });
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="bg-white border border-slate-200 rounded-xl px-3 py-3 text-center"
        >
          <p className="text-[9px] font-bold uppercase text-slate-400 tracking-wide leading-tight">
            {c.label}
          </p>
          <p className={`text-lg font-bold mt-1 ${c.accent}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}
