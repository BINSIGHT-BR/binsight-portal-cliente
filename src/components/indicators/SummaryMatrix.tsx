import { Link } from 'react-router-dom';

interface Row {
  monthLabel: string;
  vendedor: string;
  count: number;
}

interface Props {
  rows: Row[];
}

export default function SummaryMatrix({ rows }: Props) {
  if (!rows.length) {
    return null;
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-800">Resumo mês × vendedor</h3>
        <Link
          to="/admin/pedidos"
          className="text-[10px] font-bold text-purple-700 hover:underline"
        >
          Ver pedidos no Mapa
        </Link>
      </div>
      <div className="overflow-x-auto max-h-64">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase text-[10px]">
            <tr>
              <th className="text-left px-3 py-2 font-bold">Mês</th>
              <th className="text-left px-3 py-2 font-bold">Vendedor</th>
              <th className="text-right px-3 py-2 font-bold">Vendas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr key={`${r.monthLabel}-${r.vendedor}-${i}`} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-700">{r.monthLabel}</td>
                <td className="px-3 py-2 text-slate-800 font-medium">{r.vendedor}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-600">{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
