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
import type { MonthBucketRow } from '../../utils/orderIndicators';
import { BUCKET_COLORS, BUCKET_LABELS } from '../../utils/orderIndicators';

interface Props {
  data: MonthBucketRow[];
}

const SERIES = ['pendente', 'faturado', 'entregue', 'cancelado', 'rma'] as const;

export default function StatusMixChart({ data }: Props) {
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
          formatter={(value: number, name: string) => [
            `${value} venda(s)`,
            BUCKET_LABELS[name as keyof typeof BUCKET_LABELS] ?? name,
          ]}
        />
        <Legend
          formatter={(value) => BUCKET_LABELS[value as keyof typeof BUCKET_LABELS] ?? value}
          wrapperStyle={{ fontSize: 11 }}
        />
        {SERIES.map((key) => (
          <Bar
            key={key}
            dataKey={key}
            stackId="status"
            fill={BUCKET_COLORS[key]}
            name={key}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
