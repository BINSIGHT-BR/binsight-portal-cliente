import { Plus, Trash2 } from 'lucide-react';
import { formatCNPJ } from '../utils/orders';

interface Props {
  values: string[];
  onChange: (values: string[]) => void;
  inputCls?: string;
  label?: string;
  hint?: string;
}

export default function CnpjListFields({
  values,
  onChange,
  inputCls = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500',
  label = 'CNPJ da empresa',
  hint = 'Com ou sem pontuação — zeros à esquerda são preservados.',
}: Props) {
  const updateAt = (index: number, raw: string) => {
    const next = [...values];
    next[index] = formatCNPJ(raw.replace(/\D/g, '').slice(0, 14));
    onChange(next);
  };

  const addRow = () => onChange([...values, '']);

  const removeRow = (index: number) => {
    if (index === 0 || values.length <= 1) return;
    onChange(values.filter((_, i) => i !== index));
  };

  return (
    <div>
      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">{label}</label>
      <div className="space-y-2">
        {values.map((value, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="text"
              value={value}
              onChange={(e) => updateAt(index, e.target.value)}
              placeholder="00.000.000/0000-00"
              required={index === 0}
              className={`${inputCls} font-mono flex-1`}
            />
            {index === 0 ? (
              <button
                type="button"
                onClick={addRow}
                className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition"
                title="Adicionar CNPJ"
              >
                <Plus className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => removeRow(index)}
                className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition"
                title="Remover CNPJ"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>
      {hint && <p className="text-[10px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}
