"use client";

import type { VideoWithCategory } from "@/entities/video/video.types";
import { getVideoRoute } from "@/entities/video/video.routes";
import { formatViewCount } from "@/shared/lib/format";
import { Play, Eye, Heart, ListPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useTranslation } from 'react-i18next';
import { useVideoViewIncrement } from '@/shared/hooks/useVideoViewIncrement';
import { KeyboardEvent, memo, useCallback } from "react";
import { LazyImage } from "@/shared/components/LazyImage";
import { getReliableYouTubeThumbnailUrl } from "@/shared/lib/youtube";
import { SemanticTagBadge } from "./SemanticTagBadge";
import { EnrichmentIndicator } from "./EnrichmentIndicator";
import { VideoDurationBadge } from "./VideoDurationBadge";

interface VideoCardProps {
  video: VideoWithCategory;
  onClick?: () => void;
  onTagClick?: (tag: string) => void;
  variant?: 'default' | 'compact';
}

const VideoCardComponent = ({ video, onClick, onTagClick, variant = 'default' }: VideoCardProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { viewCount, showPlus, handleViewIncrement } = useVideoViewIncrement(video.view_count || 0);
  const displayTitle = !video.title?.trim() || video.title.trim().toLowerCase() === video.youtube_id?.toLowerCase()
    ? 'Título indisponível — metadados pendentes'
    : video.title;
  const hasOptimizedTitleTooltip = !!video.enrichment?.optimized_title && video.enrichment.optimized_title !== video.title;
  const normalizedLanguage = (video.language || '').toLowerCase();
  const languageLabel =
    normalizedLanguage === 'pt' ||
    normalizedLanguage === 'en' ||
    normalizedLanguage === 'es' ||
    normalizedLanguage === 'fr'
      ? t(`common.language.${normalizedLanguage}`)
      : normalizedLanguage === 'und' || normalizedLanguage === 'other'
        ? t('common.language.other')
        : video.language;

  const handleClick = useCallback(() => {
    handleViewIncrement(video.id);

    if (onClick) {
      onClick();
    } else {
      navigate(getVideoRoute(video));
    }
  }, [handleViewIncrement, navigate, onClick, video]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  }, [handleClick]);

  return (
    <article
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="link"
      aria-label={displayTitle}
      className={cn(
        "group cursor-pointer bg-card overflow-hidden transition-colors border border-border hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        variant === 'default' && "flex h-full min-h-[320px] flex-col",
        variant === 'compact' && "flex items-center gap-3 p-2 rounded-md hover:bg-muted/30 hover:shadow-none border border-border/40"
      )}
    >
      {/* Thumbnail */}
      <div className={cn(
        "relative aspect-video overflow-hidden",
        variant === 'default' ? "h-auto" : "w-28 h-16 flex-shrink-0 rounded-sm"
      )}>
        <LazyImage
          src={getReliableYouTubeThumbnailUrl(video.thumbnail_url, '/placeholder.svg')}
          alt={displayTitle}
          fallbackSrc="/placeholder.svg"
          className="w-full h-full object-cover transition-transform duration-200 motion-safe:group-hover:scale-[1.02]"
        />

        <div className="absolute left-2 top-2 z-20 flex max-w-[calc(100%-1rem)] flex-wrap items-center gap-1.5">
          {video.is_featured && variant === 'default' && (
            <Badge variant="secondary" className="uppercase px-2 py-1 text-xs">
              {t('labels.featured')}
            </Badge>
          )}
          <Badge
            variant="secondary"
            className={cn(
              "bg-background/90 text-[0.65rem] font-bold uppercase tracking-widest",
              variant === 'compact' && "px-1.5 py-0 text-[0.55rem]"
            )}
          >
            {languageLabel}
          </Badge>
        </div>

          {/* Enrichment indicator */}
          {video.enrichment && variant === 'default' && (
            <div className="absolute right-2 top-2 z-10">
              <EnrichmentIndicator size="sm" />
            </div>
          )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/15 transition-colors duration-300 flex items-center justify-center">
          <div className={cn(
            "bg-primary flex items-center justify-center opacity-0 scale-90 transition-[opacity,transform] duration-150 motion-safe:group-hover:scale-100 group-hover:opacity-100",
            variant === 'default' ? "w-14 h-14" : "w-10 h-10"
          )}>
            <Play className={cn(
              "text-primary-foreground ml-1",
              variant === 'default' ? "w-6 h-6" : "w-4 h-4"
            )} fill="currentColor" />
          </div>
        </div>

        <VideoDurationBadge durationSeconds={video.duration_seconds} className={variant === 'compact' ? 'bottom-1 right-1 min-w-9 px-1.5 py-0.5 text-[0.58rem]' : undefined} />
      </div>

      {/* Content */}
      <div className={cn(
        "flex flex-col",
        variant === 'default' ? "flex-1 space-y-3 p-4" : "min-w-0 flex-1 space-y-1"
      )}>
          {hasOptimizedTitleTooltip ? (
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <h3 className={cn(
                  "font-semibold leading-snug line-clamp-2 group-hover:opacity-75 transition-opacity uppercase tracking-[0.05em]",
                  variant === 'default' ? "text-sm" : "text-xs"
                )}>
                  {displayTitle}
                </h3>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs font-semibold mb-1">{t('labels.aiOptimizedTitle')}</p>
                <p className="text-sm">{video.enrichment?.optimized_title}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <h3 className={cn(
              "font-semibold leading-snug line-clamp-2 group-hover:opacity-75 transition-opacity uppercase tracking-[0.05em]",
              variant === 'default' ? "text-sm" : "text-xs"
            )}>
              {displayTitle}
            </h3>
          )}
        
        <p className={cn(
          "text-muted-foreground line-clamp-1",
          variant === 'default' ? "text-xs" : "text-2xs"
        )}>
          {video.channel_name}
        </p>

          {/* Semantic tags */}
          {variant === 'default' && video.enrichment?.semantic_tags && video.enrichment.semantic_tags.length > 0 && (
            <div className="flex min-h-6 flex-wrap gap-1.5 overflow-hidden">
              {video.enrichment.semantic_tags.slice(0, 3).map((tag, index) => (
                <SemanticTagBadge
                  key={`${tag}-${index}`}
                  tag={tag}
                  onClick={onTagClick ? () => onTagClick(tag) : undefined}
                />
              ))}
            </div>
          )}

        <div className={cn(
          "flex min-h-[24px] items-center justify-between text-xs text-muted-foreground",
          variant === 'compact' && "hidden",
          variant === 'default' && "mt-auto"
        )}>
          <div className="flex items-center gap-3 relative">
            <span className="inline-flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{formatViewCount(viewCount)}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Heart className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{video.favorites_count ?? 0}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <ListPlus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{video.playlist_add_count ?? 0}</span>
            </span>
            {showPlus && (
              <span className="absolute -right-6 -top-1 text-xs text-green-400 font-semibold animate-pop">+1</span>
            )}
          </div>
          {video.category && (
            <Badge 
              variant="outline" 
              className="text-[0.65rem] px-2 py-0.5 uppercase tracking-widest"
              style={{ borderColor: video.category.color, color: video.category.color }}
            >
              {video.category.name}
            </Badge>
          )}
        </div>
      </div>
    </article>
  );
};

export const VideoCard = memo(VideoCardComponent);
