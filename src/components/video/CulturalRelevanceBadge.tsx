import { Badge } from '@/components/ui/badge';
import { Flame, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CulturalRelevanceBadgeProps {
  relevance: string | null | undefined;
  className?: string;
  showLabel?: boolean;
}

export function CulturalRelevanceBadge({ 
  relevance, 
  className,
  showLabel = true 
}: CulturalRelevanceBadgeProps) {
  if (!relevance) return null;
  
  const normalized = relevance.toLowerCase();
  
  const config: Record<string, { icon: React.ReactNode; label: string; colorClasses: string }> = {
    high: {
      icon: <Flame className="w-3 h-3" />,
      label: 'High Relevance',
      colorClasses: 'bg-red-100 !text-red-950 border-red-400 dark:bg-red-950 dark:!text-red-100 dark:border-red-700',
    },
    medium: {
      icon: <TrendingUp className="w-3 h-3" />,
      label: 'Medium Relevance',
      colorClasses: 'bg-amber-100 !text-amber-950 border-amber-500 dark:bg-amber-950 dark:!text-amber-100 dark:border-amber-600',
    },
    low: {
      icon: <Minus className="w-3 h-3" />,
      label: 'Low Relevance',
      colorClasses: 'bg-slate-100 !text-slate-950 border-slate-400 dark:bg-slate-900 dark:!text-slate-100 dark:border-slate-600',
    },
  };
  
  const current = config[normalized] || config.low;
  
  return (
    <Badge
      variant="outline"
      className={cn(
        'flex items-center gap-1 text-xs font-normal',
        current.colorClasses,
        className,
      )}
    >
      {current.icon}
      {showLabel && <span>{current.label}</span>}
    </Badge>
  );
}
