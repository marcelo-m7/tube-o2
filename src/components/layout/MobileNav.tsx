import React from 'react';
import { useNavigate } from "react-router-dom";
import { useTranslation } from 'react-i18next';
import { 
  Search, Plus, LogOut, Heart,
  User as UserIcon, Settings,
  UploadCloud, ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { NavLink } from "@/components/NavLink";
import { User } from '@supabase/supabase-js';
import { Profile } from '@/entities/profile/profile.types';
import { mobileNavigationGroups } from './navigationItems';

interface MobileNavProps {
  user: User | null;
  profile: Profile | null | undefined;
  unreadMessagesCount: number;
  unreadNotificationsCount: number;
  onClose: () => void;
  onSignOut: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  languageSwitcher: React.ReactNode;
  themeToggle: React.ReactNode;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  user,
  profile,
  unreadMessagesCount,
  unreadNotificationsCount,
  onClose,
  onSignOut,
  searchQuery,
  setSearchQuery,
  onSearchSubmit,
  languageSwitcher,
  themeToggle
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const displayName = profile?.display_name || profile?.username || user?.email || 'User';

  const getBadgeCount = (path: string) => {
    if (path === '/messages') return unreadMessagesCount;
    if (path === '/notifications') return unreadNotificationsCount;
    return 0;
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden">
      <div className="space-y-3 px-1 pb-6 pt-2">
        <form onSubmit={onSearchSubmit} className="relative group">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            type="search"
            aria-label={t('header.searchPlaceholder')}
            placeholder={t('header.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 bg-muted/50 border-transparent focus-visible:ring-primary/30 h-12 rounded-xl transition-[border-color,box-shadow] shadow-sm"
          />
        </form>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="hero"
            className="h-11 justify-center gap-2 rounded-xl"
            onClick={() => handleNavigate('/submit')}
          >
            <Plus className="h-4 w-4" />
            {t('header.submitVideo')}
          </Button>
          <Button
            variant="outline"
            className="h-11 justify-center gap-2 rounded-xl"
            onClick={() => handleNavigate('/submissions')}
          >
            <UploadCloud className="h-4 w-4" />
            {t('header.imports')}
          </Button>
        </div>
      </div>

      <Separator className="opacity-50" />

      <ScrollArea className="flex-1 py-4 px-1">
        <div className="space-y-8">
          <nav className="space-y-6" aria-label={t('footer.navigation')}>
            <p className="px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-70">
              {t('footer.navigation')}
            </p>
            {mobileNavigationGroups.map((group) => (
              <div key={group.key} className="space-y-2">
                <p className="px-4 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
                  {t(group.labelKey)}
                </p>
                <div className="grid gap-1">
                  {group.items.map((link) => {
                    const badgeCount = getBadgeCount(link.to);

                    return (
                      <NavLink
                        key={link.to}
                        to={link.to}
                        end={link.to === '/' || link.to === '/playlists'}
                        className="flex items-center gap-3 rounded-2xl px-4 py-3.5 text-muted-foreground transition-colors duration-150 hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        activeClassName="bg-primary/10 text-foreground font-bold"
                        onClick={onClose}
                      >
                        <link.icon className="h-5 w-5" aria-hidden="true" />
                        <span className="text-sm flex-1">{t(link.labelKey)}</span>
                        {badgeCount > 0 && (
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold leading-none text-primary-foreground">
                            {badgeCount > 99 ? '99+' : badgeCount}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <Separator className="opacity-50 mx-4" />

          {user ? (
            <div className="space-y-4">
              <p className="px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-3 opacity-70">
                {t('header.accountSettings')}
              </p>
              <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-2xl mx-4 border border-border/50">
                <Avatar className="h-10 w-10 border-2 border-primary/20 shadow-sm">
                  <AvatarImage src={profile?.avatar_url || undefined} alt={displayName} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold">
                    {displayName[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{displayName}</p>
                  <p className="text-[10px] text-muted-foreground truncate opacity-80">{user.email}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-1">
                {profile?.username && <NavLink
                    to={`/profile/${profile.username}`}
                    className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-2xl transition-colors duration-150"
                    activeClassName="bg-primary/8 text-foreground font-medium"
                    onClick={onClose}
                  >
                    <UserIcon className="h-5 w-5" />
                    <span className="text-sm">{t('header.myProfile')}</span>
                  </NavLink>}
                <NavLink
                  to="/favorites"
                  className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-2xl transition-colors duration-150"
                  activeClassName="bg-primary/8 text-foreground font-medium"
                  onClick={onClose}
                >
                  <Heart className="h-5 w-5" />
                  <span className="text-sm">{t('header.favorites')}</span>
                </NavLink>
                {profile?.username && <NavLink
                  to="/profile/edit"
                  className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-2xl transition-colors duration-150"
                  activeClassName="bg-primary/8 text-foreground font-medium"
                  onClick={onClose}
                >
                  <Settings className="h-5 w-5" />
                  <span className="text-sm">{t('header.editProfile')}</span>
                </NavLink>}
                <NavLink
                  to="/account/settings"
                  className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-2xl transition-colors duration-150"
                  activeClassName="bg-primary/8 text-foreground font-medium"
                  onClick={onClose}
                >
                  <Settings className="h-5 w-5" />
                  <span className="text-sm">{t('header.accountSettings')}</span>
                </NavLink>
                {(profile?.role === 'editor' || profile?.role === 'admin') && (
                  <>
                    <NavLink
                      to="/editorial"
                      className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-2xl transition-colors duration-150"
                      activeClassName="bg-primary/8 text-foreground font-medium"
                      onClick={onClose}
                    >
                      <ShieldCheck className="h-5 w-5" />
                      <span className="text-sm">{t('header.editorialPortal')}</span>
                    </NavLink>
                    <NavLink
                      to="/editor/applications"
                      className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-2xl transition-colors duration-150"
                      activeClassName="bg-primary/8 text-foreground font-medium"
                      onClick={onClose}
                    >
                      <ShieldCheck className="h-5 w-5" />
                      <span className="text-sm">{t('editorApplications.adminPage.title')}</span>
                    </NavLink>
                  </>
                )}
              </div>

              <div className="pt-2 px-4 space-y-3">
                <Button
                  variant="hero"
                  className="w-full justify-center gap-2 h-12 rounded-2xl shadow-md"
                  onClick={() => handleNavigate('/submit')}
                >
                  <Plus className="h-5 w-5" />
                  {t('header.submitVideo')}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-center gap-2 h-12 rounded-2xl text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                  onClick={onSignOut}
                >
                  <LogOut className="h-5 w-5" />
                  {t('header.logout')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 px-4">
              <Button
                variant="hero"
                className="w-full justify-center gap-2 h-12 rounded-2xl shadow-md"
                onClick={() => handleNavigate('/submit')}
              >
                <Plus className="h-5 w-5" />
                {t('header.submitVideo')}
              </Button>
              <Button
                variant="outline"
                className="w-full h-12 rounded-2xl border-primary/20 text-foreground hover:bg-primary/5 font-bold"
                onClick={() => handleNavigate('/auth')}
              >
                {t('header.login')}
              </Button>
            </div>
          )}

          <Separator className="opacity-50 mx-4" />

          <div className="px-4 space-y-4 pb-12">
            <Label htmlFor="mobile-language-switcher" className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-70">
              {t('header.languageLabel')}
            </Label>
            {languageSwitcher}

            <div className="flex items-center justify-between rounded-2xl bg-muted/40 px-4 py-3">
              <span className="text-sm font-medium text-muted-foreground">{t('header.switchToDark')}</span>
              {themeToggle}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
