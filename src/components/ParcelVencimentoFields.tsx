import { brDateToIso, isoDateToBR } from '../utils/orders';
import { deriveStatusPgtoFromDates } from '../utils/ordersCore';

const inputCls =
  'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent';

interface Props {
  parc1: string;
  parc2: string;
  parc3: string;
  parc4: string;
  onChange: (next: {
    parc1?: string;
    parc2?: string;
    parc3?: string;
    parc4?: string;
    statusPgto?: string;
  }) => void;
  readOnlyStatus?: boolean;
  statusPgto?: string;
}

function isPaidStatus(statusPgto?: string): boolean {
  return (statusPgto ?? '').trim().toUpperCase().includes('PAGA');
}

export default function ParcelVencimentoFields({
  parc1,
  parc2,
  parc3,
  parc4,
  onChange,
  readOnlyStatus = true,
  statusPgto,
}: Props) {
  const paid = isPaidStatus(statusPgto);

  const fields = [
    { key: 'parc1' as const, label: '1ª Parc. vencimento (col L)', value: parc1 },
    { key: 'parc2' as const, label: '2ª Parc. vencimento (col M)', value: parc2 },
    { key: 'parc3' as const, label: '3ª Parc. vencimento (col N)', value: parc3 },
    { key: 'parc4' as const, label: '4ª Parc. vencimento (col O)', value: parc4 },
  ];

  const applyDate = (key: 'parc1' | 'parc2' | 'parc3' | 'parc4', iso: string) => {
    const next = {
      parc1,
      parc2,
      parc3,
      parc4,
      [key]: iso ? isoDateToBR(iso) : '',
    };
    const dates = [next.parc1, next.parc2, next.parc3, next.parc4];
    onChange({
      ...next,
      statusPgto: paid ? 'PAGA' : dates.some((d) => d.trim()) ? 'A VENCER' : 'SEM DATA',
    });
  };

  const togglePaid = (checked: boolean) => {
    if (checked) {
      onChange({ statusPgto: 'PAGA' });
      return;
    }
    onChange({
      statusPgto: deriveStatusPgtoFromDates([parc1, parc2, parc3, parc4]),
    });
  };

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-3 cursor-pointer rounded-xl border border-green-100 bg-green-50/80 p-3">
        <input
          type="checkbox"
          checked={paid}
          onChange={(e) => togglePaid(e.target.checked)}
          className="rounded border-slate-300 text-green-600 focus:ring-green-500"
        />
        <span className="text-sm text-slate-700">
          <strong>Cliente pagou</strong> — col P = <span className="font-mono">PAGA</span> (vencimentos
          L–O permanecem no histórico)
        </span>
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map(({ key, label, value }) => (
          <div key={key}>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">{label}</label>
            <input
              type="date"
              value={value ? brDateToIso(value) : ''}
              onChange={(e) => applyDate(key, e.target.value)}
              className={inputCls}
            />
          </div>
        ))}
        {readOnlyStatus && (
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              Status pagamento (col P)
            </label>
            <input
              type="text"
              readOnly
              value={statusPgto ?? 'SEM DATA'}
              className={`${inputCls} bg-slate-50 text-slate-500`}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export { inputCls as formInputCls };
