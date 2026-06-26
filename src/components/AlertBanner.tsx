import { type ReactNode, useState } from 'react';
import { AlertTriangle, Bell, ChevronDown, ChevronUp, FileWarning } from 'lucide-react';
import { OrderAlert } from '../types';
import { countAlertsByKind } from '../utils/alerts';

interface Props {
  alerts: OrderAlert[];
  onSelectAlert?: (alert: OrderAlert) => void;
}

export default function AlertBanner({ alerts, onSelectAlert }: Props) {
  const [criticalOpen, setCriticalOpen] = useState(false);
  const [warningOpen, setWarningOpen] = useState(false);

  if (alerts.length === 0) return null;

  const counts = countAlertsByKind(alerts);
  const critical = alerts.filter((a) => a.severity === 'critical');
  const warnings = alerts.filter((a) => a.severity === 'warning');

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {counts.pagamento_vencido > 0 && (
          <StatPill
            icon={<AlertTriangle className="w-3.5 h-3.5" />}
            label="Pagamento vencido"
            count={counts.pagamento_vencido}
            tone="critical"
          />
        )}
        {counts.pagamento_a_vencer > 0 && (
          <StatPill
            icon={<Bell className="w-3.5 h-3.5" />}
            label="A vencer"
            count={counts.pagamento_a_vencer}
            tone="warning"
          />
        )}
        {counts.nf_pendente > 0 && (
          <StatPill
            icon={<FileWarning className="w-3.5 h-3.5" />}
            label="NF pendente (+3d)"
            count={counts.nf_pendente}
            tone="warning"
          />
        )}
      </div>

      {critical.length > 0 && (
        <CollapsibleAlertBox
          title="Atenção imediata"
          count={critical.length}
          open={criticalOpen}
          onToggle={() => setCriticalOpen((v) => !v)}
          tone="critical"
        >
          <ul className="space-y-1.5">
            {critical.map((a, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onSelectAlert?.(a)}
                  className="text-left text-[11px] text-red-700 hover:underline w-full"
                >
                  {a.message}
                </button>
              </li>
            ))}
          </ul>
        </CollapsibleAlertBox>
      )}

      {warnings.length > 0 && (
        <CollapsibleAlertBox
          title="Alertas operacionais"
          count={warnings.length}
          open={warningOpen}
          onToggle={() => setWarningOpen((v) => !v)}
          tone="warning"
        >
          <ul className="space-y-1.5 max-h-48 overflow-y-auto">
            {warnings.map((a, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onSelectAlert?.(a)}
                  className="text-left text-[11px] text-amber-800 hover:underline w-full"
                >
                  {a.message}
                </button>
              </li>
            ))}
          </ul>
        </CollapsibleAlertBox>
      )}
    </div>
  );
}

function CollapsibleAlertBox({
  title,
  count,
  open,
  onToggle,
  tone,
  children,
}: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  tone: 'critical' | 'warning';
  children: ReactNode;
}) {
  const boxCls =
    tone === 'critical'
      ? 'border-red-200 bg-red-50 text-red-800'
      : 'border-amber-200 bg-amber-50 text-amber-800';

  return (
    <div className={`rounded-xl border ${boxCls.split(' ').slice(0, 2).join(' ')}`}>
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center justify-between gap-2 px-4 py-3 text-left ${boxCls.split(' ')[2]}`}
      >
        <span className="text-xs font-bold uppercase tracking-wide">
          {title} <span className="font-mono opacity-80">({count})</span>
        </span>
        {open ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
      </button>
      {open && <div className={`px-4 pb-4 ${tone === 'critical' ? 'text-red-700' : 'text-amber-800'}`}>{children}</div>}
    </div>
  );
}

function StatPill({
  icon,
  label,
  count,
  tone,
}: {
  icon: ReactNode;
  label: string;
  count: number;
  tone: 'critical' | 'warning';
}) {
  const cls =
    tone === 'critical'
      ? 'bg-red-100 text-red-800 border-red-200'
      : 'bg-amber-100 text-amber-800 border-amber-200';

  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wide ${cls}`}
    >
      {icon}
      {label}
      <span className="bg-white/60 px-1.5 py-0.5 rounded font-mono">{count}</span>
    </span>
  );
}
