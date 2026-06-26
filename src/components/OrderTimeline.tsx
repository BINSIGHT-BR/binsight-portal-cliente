import { Check, Truck } from 'lucide-react';
import { TimelineStage, TimelineStageId } from '../types';

interface Props {
  stages: TimelineStage[];
  current: TimelineStageId;
  completed: TimelineStageId[];
  compact?: boolean;
}

export default function OrderTimeline({ stages, current, completed, compact }: Props) {
  const currentIdx = stages.findIndex((s) => s.id === current);

  return (
    <div className={`w-full ${compact ? 'py-2' : 'py-4'}`}>
      <div className="flex items-start justify-between relative">
        <div
          className="absolute top-4 left-0 right-0 h-0.5 bg-slate-200 mx-8"
          aria-hidden
        />
        <div
          className="absolute top-4 left-0 h-0.5 bg-purple-500 mx-8 transition-all duration-500"
          style={{
            width: currentIdx <= 0 ? '0%' : `${(currentIdx / (stages.length - 1)) * 100}%`,
            maxWidth: 'calc(100% - 4rem)',
          }}
          aria-hidden
        />

        {stages.map((stage, idx) => {
          const isCompleted = completed.includes(stage.id) && stage.id !== current;
          const isCurrent = stage.id === current;
          const isPast = idx < currentIdx;

          return (
            <div
              key={stage.id}
              className="flex flex-col items-center flex-1 min-w-0 relative z-10"
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                  isCompleted || isPast
                    ? 'bg-purple-600 border-purple-600 text-white'
                    : isCurrent
                      ? 'bg-white border-purple-600 text-purple-700 ring-4 ring-purple-100'
                      : 'bg-white border-slate-300 text-slate-400'
                }`}
              >
                {isCompleted || isPast ? (
                  <Check className="w-4 h-4" strokeWidth={3} />
                ) : isCurrent && stage.id === 'rota' ? (
                  <Truck className="w-4 h-4" strokeWidth={2.5} />
                ) : isCurrent ? (
                  <span className="text-xs font-bold">{idx + 1}</span>
                ) : (
                  <span className="text-xs font-bold text-slate-300">{idx + 1}</span>
                )}
              </div>
              <p
                className={`mt-2 text-center leading-tight ${
                  compact ? 'text-[9px]' : 'text-[10px]'
                } font-bold uppercase tracking-wide ${
                  isCurrent ? 'text-purple-700' : isCompleted || isPast ? 'text-slate-700' : 'text-slate-400'
                }`}
              >
                {stage.label}
              </p>
              {!compact && stage.description && isCurrent && (
                <p className="mt-1 text-[9px] text-slate-500 text-center max-w-[100px] hidden sm:block">
                  {stage.description}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
