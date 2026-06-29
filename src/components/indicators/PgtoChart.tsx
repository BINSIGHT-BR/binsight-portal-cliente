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
import type { MonthPgtoRow } from '../../utils/orderIndicators';

interface Props {
  data: MonthPgtoRow[];
}

const PGTO_COLORS = {
  vencida: '#ef4444',
  aVencer: '#f59e0b',
  emDia: '#22c55e',
  semData: '#94a3b8',
};

const PGTO_LABELS: Record<keyof typeof PGTO_COLORS, string> = {
  vencida: 'Vencida',
  aVencer: 'A vencer',
  emDia: 'Em dia',
  semData: 'Sem data',
};

export default function PgtoChart({ data }: Props) {
  if (!data.length) {
    return (
      <p className="text-sm text-slate-400 py-12 text-center">Sem dados no período selecionado.</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(value: number, name: string) => [`${value}`, PGTO_LABELS[name as keyof typeof PGTO_LABELS] ?? name]} />
        <Legend
          formatter={(value) => PGTO_LABELS[value as keyof typeof PGTO_LABELS] ?? value}
          wrapperStyle={{ fontSize: 11 }}
        />
        {(Object.keys(PGTO_COLORS) as (keyof typeof PGTO_COLORS)[]).map((key) => (
          <Bar key={key} dataKey={key} stackId="pgto" fill={PGTO_COLORS[key]} name={key} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
