import { brDateToIso, isoDateToBR } from '../utils/orders';
import {
  deriveStatusPgtoFromParcels,
  formatParcelValue,
  parseParcelValue,
} from '../utils/parcelPayment';

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

export default function ParcelVencimentoFields({
  parc1,
  parc2,
  parc3,
  parc4,
  onChange,
  readOnlyStatus = true,
  statusPgto,
}: Props) {
  const fields = [
    { key: 'parc1' as const, label: '1ª parcela (col L)', raw: parc1 },
    { key: 'parc2' as const, label: '2ª parcela (col M)', raw: parc2 },
    { key: 'parc3' as const, label: '3ª parcela (col N)', raw: parc3 },
    { key: 'parc4' as const, label: '4ª parcela (col O)', raw: parc4 },
  ];

  const pushChange = (next: { parc1: string; parc2: string; parc3: string; parc4: string }) => {
    onChange({
      ...next,
      statusPgto: deriveStatusPgtoFromParcels(next.parc1, next.parc2, next.parc3, next.parc4),
    });
  };

  const applyDate = (key: 'parc1' | 'parc2' | 'parc3' | 'parc4', iso: string) => {
    const parsed = parseParcelValue(fields.find((f) => f.key === key)!.raw);
    const dateBR = iso ? isoDateToBR(iso) : '';
    const next = {
      parc1,
      parc2,
      parc3,
      parc4,
      [key]: formatParcelValue(dateBR, parsed.paid),
    };
    pushChange(next);
  };

  const toggleParcelPaid = (key: 'parc1' | 'parc2' | 'parc3' | 'parc4', checked: boolean) => {
    const parsed = parseParcelValue(fields.find((f) => f.key === key)!.raw);
    const next = {
      parc1,
      parc2,
      parc3,
      parc4,
      [key]: formatParcelValue(parsed.dateBR, checked),
    };
    pushChange(next);
  };

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-slate-500 leading-relaxed">
        Marque <strong>Paga</strong> em cada parcela. Col P = <span className="font-mono">PAGA</span>{' '}
        quando todas as parcelas com data estiverem pagas.
      </p>

      <div className="space-y-3">
        {fields.map(({ key, label, raw }) => {
          const parsed = parseParcelValue(raw);
          return (
            <div
              key={key}
              className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end rounded-xl border border-slate-100 bg-slate-50/50 p-3"
            >
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  {label}
                </label>
                <input
                  type="date"
                  value={parsed.dateBR ? brDateToIso(parsed.dateBR) : ''}
                  onChange={(e) => applyDate(key, e.target.value)}
                  className={inputCls}
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer pb-2 sm:pb-2.5 shrink-0">
                <input
                  type="checkbox"
                  checked={parsed.paid}
                  onChange={(e) => toggleParcelPaid(key, e.target.checked)}
                  className="rounded border-slate-300 text-green-600 focus:ring-green-500"
                />
                <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">Paga</span>
              </label>
            </div>
          );
        })}
      </div>

      {readOnlyStatus && (
        <div>
          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
            Status pagamento (col P)
          </label>
          <input
            type="text"
            readOnly
            value={statusPgto ?? deriveStatusPgtoFromParcels(parc1, parc2, parc3, parc4)}
            className={`${inputCls} bg-slate-50 text-slate-500`}
          />
        </div>
      )}
    </div>
  );
}

export { inputCls as formInputCls };
