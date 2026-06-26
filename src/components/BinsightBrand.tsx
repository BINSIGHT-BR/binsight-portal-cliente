import logoHorizontalUrl from '@assets/binsight-logo-horizontal.png';
import logoIconUrl from '@assets/binsight-logo-icon.png';

interface Props {
  subtitle?: string;
  variant?: 'auth' | 'header';
}

export default function BinsightBrand({
  subtitle = 'BInsight Connect · Acompanhe seus pedidos',
  variant = 'auth',
}: Props) {
  if (variant === 'header') {
    return (
      <div className="flex items-center min-w-0 gap-2">
        <img
          src={logoIconUrl}
          alt="BInsight"
          className="sm:hidden h-8 w-auto shrink-0 object-contain"
          draggable={false}
        />
        <img
          src={logoHorizontalUrl}
          alt="BInsight"
          className="hidden sm:block h-7 w-auto max-w-[200px] object-contain object-left"
          draggable={false}
        />
        <span className="hidden lg:block text-[10px] text-slate-400 font-medium tracking-wide border-l border-slate-200 pl-3 ml-1 truncate">
          {subtitle}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <img
        src={logoHorizontalUrl}
        alt="BInsight"
        className="h-12 sm:h-14 w-auto max-w-[min(100%,320px)] object-contain"
        draggable={false}
      />
      <p className="text-center text-xs text-slate-500 font-medium tracking-wide">{subtitle}</p>
    </div>
  );
}
