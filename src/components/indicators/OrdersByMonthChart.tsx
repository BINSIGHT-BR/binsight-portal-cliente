import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MonthVendedorRow } from '../../utils/orderIndicators';
import { vendedorColor } from '../../utils/orderIndicators';

interface Props {
  data: MonthVendedorRow[];
  vendedores: string[];
  activeVendedores: string[];
}

export default function OrdersByMonthChart({ data, vendedores, activeVendedores }: Props) {
  const series =
    activeVendedores.length > 0
      ? activeVendedores
      : vendedores.filter((v) => data.some((row) => Number(row[v] ?? 0) > 0));

  if (!data.length) {
    return (
      <p className="text-sm text-slate-400 py-12 text-center">Sem dados no período selecionado.</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value: number, name: string) => [`${value} linha(s)`, name]}
          labelFormatter={(label) => `Mês: ${label}`}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {series.map((v) => (
          <Bar
            key={v}
            dataKey={v}
            stackId="vendedor"
            fill={vendedorColor(v, vendedores)}
            name={v}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
