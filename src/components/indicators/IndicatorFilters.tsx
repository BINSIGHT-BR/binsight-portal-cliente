import type { IndicatorFilters, MapaTabFilter, PedidoBucket } from '../../utils/orderIndicators';
import { BUCKET_LABELS } from '../../utils/orderIndicators';

interface Props {
  filters: IndicatorFilters;
  vendedores: string[];
  distribuidores: string[];
  onChange: (next: IndicatorFilters) => void;
  onReset: () => void;
}

const BUCKETS: PedidoBucket[] = ['pendente', 'faturado', 'entregue', 'cancelado', 'rma'];

const TAB_OPTIONS: { value: MapaTabFilter; label: string }[] = [
  { value: 'todas', label: 'Todas (CONSOLIDADO + mensais)' },
  { value: 'consolidado', label: 'Só CONSOLIDADO' },
  { value: 'mensais', label: 'Só abas mensais' },
];

function toggleInList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

function toggleBucket(list: PedidoBucket[], value: PedidoBucket): PedidoBucket[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

export default function IndicatorFilters({
  filters,
  vendedores,
  distribuidores,
  onChange,
  onReset,
}: Props) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[10px] font-bold uppercase text-slate-500">
          De
          <input
            type="date"
            value={filters.dateFrom ?? ''}
            onChange={(e) => onChange({ ...filters, dateFrom: e.target.value || undefined })}
            className="text-sm border border-slate-200 rounded-lg px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1 text-[10px] font-bold uppercase text-slate-500">
          Até
          <input
            type="date"
            value={filters.dateTo ?? ''}
            onChange={(e) => onChange({ ...filters, dateTo: e.target.value || undefined })}
            className="text-sm border border-slate-200 rounded-lg px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1 text-[10px] font-bold uppercase text-slate-500 min-w-[180px]">
          Aba Mapa
          <select
            value={filters.mapaTab}
            onChange={(e) => onChange({ ...filters, mapaTab: e.target.value as MapaTabFilter })}
            className="text-sm border border-slate-200 rounded-lg px-2 py-1.5"
          >
            {TAB_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={onReset}
          className="text-xs font-bold text-slate-500 hover:text-purple-700 px-3 py-2"
        >
          Limpar filtros
        </button>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase text-slate-500 mb-2">Vendedor</p>
        <div className="flex flex-wrap gap-1.5">
          {vendedores.map((v) => {
            const active = filters.vendedores.length === 0 || filters.vendedores.includes(v);
            const selected = filters.vendedores.includes(v);
            return (
              <button
                key={v}
                type="button"
                onClick={() =>
                  onChange({
                    ...filters,
                    vendedores: toggleInList(filters.vendedores, v),
                  })
                }
                className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition ${
                  selected
                    ? 'bg-purple-100 border-purple-300 text-purple-800'
                    : active
                      ? 'bg-slate-50 border-slate-200 text-slate-600 hover:border-purple-200'
                      : 'bg-white border-slate-100 text-slate-400 opacity-60'
                }`}
              >
                {v}
              </button>
            );
          })}
        </div>
        {filters.vendedores.length > 0 && (
          <p className="text-[10px] text-slate-400 mt-1">
            {filters.vendedores.length} selecionado(s). Clique para alternar.
          </p>
        )}
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase text-slate-500 mb-2">Distribuidor</p>
        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
          {distribuidores.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() =>
                onChange({
                  ...filters,
                  distribuidores: toggleInList(filters.distribuidores, d),
                })
              }
              className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition ${
                filters.distribuidores.includes(d)
                  ? 'bg-indigo-100 border-indigo-300 text-indigo-800'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-indigo-200'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase text-slate-500 mb-2">Status (rótulo)</p>
        <div className="flex flex-wrap gap-1.5">
          {BUCKETS.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() =>
                onChange({
                  ...filters,
                  buckets: toggleBucket(filters.buckets, b),
                })
              }
              className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition ${
                filters.buckets.includes(b)
                  ? 'bg-amber-100 border-amber-300 text-amber-900'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              {BUCKET_LABELS[b]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
