import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SemanticTagBadgeProps {
  tag: string;
  className?: string;
  onClick?: () => void;
}

// Generate a consistent color based on tag text (using hash)
function getTagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const colors = [
    'bg-blue-100 !text-blue-950 hover:bg-blue-200 dark:bg-blue-900 dark:!text-blue-100',
    'bg-green-100 !text-green-950 hover:bg-green-200 dark:bg-green-900 dark:!text-green-100',
    'bg-purple-100 !text-purple-950 hover:bg-purple-200 dark:bg-purple-900 dark:!text-purple-100',
    'bg-pink-100 !text-pink-950 hover:bg-pink-200 dark:bg-pink-900 dark:!text-pink-100',
    'bg-orange-100 !text-orange-950 hover:bg-orange-200 dark:bg-orange-900 dark:!text-orange-100',
    'bg-teal-100 !text-teal-950 hover:bg-teal-200 dark:bg-teal-900 dark:!text-teal-100',
    'bg-indigo-100 !text-indigo-950 hover:bg-indigo-200 dark:bg-indigo-900 dark:!text-indigo-100',
    'bg-cyan-100 !text-cyan-950 hover:bg-cyan-200 dark:bg-cyan-900 dark:!text-cyan-100',
  ];
  
  return colors[Math.abs(hash) % colors.length];
}

export function SemanticTagBadge({ tag, className, onClick }: SemanticTagBadgeProps) {
  const colorClasses = getTagColor(tag);
  
  return (
    <Badge
      variant="secondary"
      className={cn(
        'text-xs font-medium transition-colors border border-border/60',
        colorClasses,
        className,
      )}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick?.();
      }}
    >
      {tag}
    </Badge>
  );
}
