import { Link, useLocation, useNavigate } from "react-router-dom";
import { Plus, Menu, Heart, Globe, User as UserIcon, Settings, KeyRound, LogOut, Bell, MessageCircle, ShieldCheck, ChevronDown, ListVideo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type ReactNode, useState } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useProfileById } from "@/features/profile/queries/useProfile";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NavLink } from "@/components/NavLink";
import { MobileNav } from "./MobileNav";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useUnreadMessagesCount } from "@/features/messages";
import { useUnreadNotificationsCount } from "@/features/notifications";
import { languageOptions, primaryNavigationItems, projectNavigationItems } from "./navigationItems";

const MOBILE_MENU_ID = "mobile-navigation-menu";

function BrandLogo({ onClick }: { onClick?: () => void }) {
  return (
    <Link to="/" className="flex min-w-0 shrink-0 items-center gap-2 group" onClick={onClick} aria-label="Tube O2 home">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-primary text-primary-foreground transition-transform group-hover:scale-105">
        <span className="text-sm font-bold tracking-tighter">O2</span>
      </div>
      <span className="hidden truncate font-bold text-lg tracking-[0.16em] uppercase sm:inline-block">
        Tube<span className="text-primary font-black">O2</span>
      </span>
    </Link>
  );
}

function DesktopNavigation() {
  const { t } = useTranslation();
  const location = useLocation();
  const projectSectionIsActive = projectNavigationItems.some((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`));

  return (
    <nav className="hidden min-w-0 items-center gap-0 xl:flex" aria-label={t('footer.navigation')}>
      {primaryNavigationItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/' || item.to === '/playlists'}
          className="whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-semibold text-muted-foreground transition-colors duration-150 hover:bg-muted/60 hover:text-foreground 2xl:px-3"
          activeClassName="text-foreground bg-primary/12 hover:bg-primary/16"
        >
          {t(item.labelKey)}
        </NavLink>
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={projectSectionIsActive
              ? "h-9 rounded-md bg-primary/12 px-2 text-sm font-semibold text-foreground hover:bg-primary/16 2xl:px-3"
              : "h-9 rounded-md px-2 text-sm font-semibold text-muted-foreground hover:bg-muted/60 hover:text-foreground 2xl:px-3"}
            aria-label={t('header.project')}
          >
            {t('header.project')}
            <ChevronDown className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 rounded-2xl p-1.5">
          {projectNavigationItems.map((item) => (
            <DropdownMenuItem key={item.to} asChild className="rounded-xl py-2">
              <NavLink to={item.to} activeClassName="font-semibold text-foreground">
                <item.icon className="mr-2 h-4 w-4" aria-hidden="true" />
                <span>{t(item.labelKey)}</span>
              </NavLink>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}

function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('i18nextLng', lng);
  };

  return (
    <Select value={i18n.language} onValueChange={changeLanguage}>
      <SelectTrigger
        id={compact ? "mobile-language-switcher" : undefined}
        aria-label={t('header.languageLabel')}
        className={compact
          ? "w-full h-12 bg-muted/50 border-transparent focus:ring-primary/30 rounded-2xl shadow-sm"
          : "w-[72px] h-8 bg-transparent border-0 shadow-none focus:ring-0 text-xs font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/60"}
      >
        <Globe className={compact ? "w-5 h-5 mr-2 text-muted-foreground" : "w-3.5 h-3.5 mr-1 shrink-0"} />
        <SelectValue />
      </SelectTrigger>
      <SelectContent className={compact ? "rounded-2xl border-border/50 elevation-dialog" : "rounded-xl min-w-[80px]"}>
        {languageOptions.map((option) => (
          <SelectItem key={option.value} value={option.value} className={compact ? "rounded-xl" : undefined}>
            {compact ? option.label : option.shortLabel}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function HeaderIconButton({ children, label, onClick }: { children: ReactNode; label: string; onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60"
      onClick={onClick}
      aria-label={label}
    >
      {children}
    </Button>
  );
}

interface NavigationActionsProps {
  loading: boolean;
  user: ReturnType<typeof useAuth>["user"];
  profile: ReturnType<typeof useProfileById>["data"];
  unreadMessagesCount: number;
  unreadNotificationsCount: number;
  onSignOut: () => void;
}

function NavigationActions({ loading, user, profile, unreadMessagesCount, unreadNotificationsCount, onSignOut }: NavigationActionsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="hidden shrink-0 items-center gap-1 xl:flex">
      {loading ? (
        <span role="status" aria-label={t('common.loading')} className="h-9 w-36 animate-pulse rounded-full bg-muted" />
      ) : user ? (
        <>
          <HeaderIconButton label={t('header.favorites')} onClick={() => navigate('/favorites')}>
            <Heart className="h-4 w-4" />
          </HeaderIconButton>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full relative text-muted-foreground hover:text-foreground hover:bg-muted/60"
            onClick={() => navigate('/messages')}
            aria-label={t('header.messages')}
          >
            <MessageCircle className="h-4 w-4" />
            {unreadMessagesCount > 0 && (
              <span className="absolute top-0.5 right-0.5 h-4 min-w-4 px-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center leading-none">
                {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
              </span>
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full relative text-muted-foreground hover:text-foreground hover:bg-muted/60"
            onClick={() => navigate('/notifications')}
            aria-label={t('header.notifications')}
          >
            <Bell className="h-4 w-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-0.5 right-0.5 h-4 min-w-4 px-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center leading-none">
                {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
              </span>
            )}
          </Button>

          <div className="h-5 w-px bg-border mx-1 shrink-0" />

          <Button
            variant="hero"
            size="sm"
            className="gap-1.5 rounded-full px-3 xl:px-4"
            onClick={() => navigate('/submit')}
            aria-label={t('header.submitVideo')}
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">{t('header.submitVideo')}</span>
          </Button>

          <UserMenu user={user} profile={profile} onSignOut={onSignOut} />
        </>
      ) : (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground rounded-full px-3 xl:px-4"
            onClick={() => navigate('/submit')}
            aria-label={t('header.submitVideo')}
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">{t('header.submitVideo')}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full px-4 xl:px-5"
            onClick={() => navigate('/auth')}
          >
            {t('header.login')}
          </Button>
        </>
      )}

      <div className="h-5 w-px bg-border mx-0.5 shrink-0" />
      <LanguageSwitcher />
      <ThemeToggle />
    </div>
  );
}

function UserMenu({ user, profile, onSignOut }: { user: NonNullable<NavigationActionsProps["user"]>; profile: NavigationActionsProps["profile"]; onSignOut: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const displayName = profile?.display_name || profile?.username || user.email || 'User';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="ml-1 h-9 w-9 rounded-full ring-2 ring-transparent hover:ring-primary/40 focus-visible:ring-primary/50 focus-visible:outline-none transition-shadow duration-150" aria-label={t('header.myProfile')}>
          <Avatar className="h-9 w-9">
            <AvatarImage src={profile?.avatar_url || undefined} alt={displayName} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
              {displayName[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60 mt-2 rounded-2xl p-1.5" align="end" forceMount>
        <DropdownMenuLabel className="font-normal py-2 px-2">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                {displayName[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <p className="text-sm font-bold leading-none truncate">{displayName}</p>
              <p className="text-xs leading-none text-muted-foreground mt-1 truncate">{user.email}</p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-1" />
        {profile?.username && (
          <>
            <DropdownMenuItem onClick={() => navigate(`/profile/${profile.username}`)} className="rounded-xl py-2">
              <UserIcon className="mr-2 h-4 w-4" />
              <span>{t('header.myProfile')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/profile/edit')} className="rounded-xl py-2">
              <Settings className="mr-2 h-4 w-4" />
              <span>{t('header.editProfile')}</span>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem onClick={() => navigate('/account/settings')} className="rounded-xl py-2">
          <KeyRound className="mr-2 h-4 w-4" />
          <span>{t('header.accountSettings')}</span>
        </DropdownMenuItem>
        {(profile?.role === 'editor' || profile?.role === 'admin') && (
          <>
            <DropdownMenuItem onClick={() => navigate('/editorial')} className="rounded-xl py-2">
              <ShieldCheck className="mr-2 h-4 w-4" />
              <span>{t('header.editorialPortal')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/editor/board')} className="rounded-xl py-2">
              <ListVideo className="mr-2 h-4 w-4" />
              <span>{t('header.editorialBoard')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/editor/applications')} className="rounded-xl py-2">
              <ShieldCheck className="mr-2 h-4 w-4" />
              <span>{t('editorApplications.adminPage.title')}</span>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator className="my-1" />
        <DropdownMenuItem onClick={onSignOut} className="rounded-xl py-2 text-destructive focus:text-destructive focus:bg-destructive/5">
          <LogOut className="mr-2 h-4 w-4" />
          <span>{t('header.logout')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const Header = () => {
  const { t } = useTranslation();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { user, signOut, loading: authLoading } = useAuth();
  const { data: profile } = useProfileById(user?.id);
  const { data: unreadMessagesCount = 0 } = useUnreadMessagesCount();
  const { data: unreadNotificationsCount = 0 } = useUnreadNotificationsCount();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
    setIsSheetOpen(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/videos?query=${encodeURIComponent(searchQuery.trim())}`);
      setIsSheetOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
      <div className="container flex h-16 items-center gap-3 xl:gap-4">
        <BrandLogo />

        {/* Divider */}
        <div className="hidden xl:block h-5 w-px bg-border shrink-0" />

        <DesktopNavigation />

        {/* Spacer */}
        <div className="min-w-2 flex-1" />

        <NavigationActions
          loading={authLoading}
          user={user}
          profile={profile}
          unreadMessagesCount={unreadMessagesCount}
          unreadNotificationsCount={unreadNotificationsCount}
          onSignOut={handleSignOut}
        />

        {/* Mobile menu trigger */}
        <div className="flex shrink-0 items-center xl:hidden">
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full hover:bg-muted/60 h-10 w-10"
              aria-label={t('header.toggleMenu')}
              aria-expanded={isSheetOpen}
              aria-controls={MOBILE_MENU_ID}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">{t('header.toggleMenu')}</span>
            </Button>
          </SheetTrigger>
        </div>

        <SheetContent id={MOBILE_MENU_ID} side="right" className="w-full max-w-[min(100vw,420px)] sm:w-[400px] md:w-[420px] flex flex-col overflow-hidden p-4 sm:p-6 rounded-l-3xl border-none elevation-dialog">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-left">
              <BrandLogo onClick={() => setIsSheetOpen(false)} />
            </SheetTitle>
            <SheetDescription className="sr-only">
              {t('header.menuDescription')}
            </SheetDescription>
          </SheetHeader>
          <MobileNav
            loading={authLoading}
            user={user}
            profile={profile}
            unreadMessagesCount={unreadMessagesCount}
            unreadNotificationsCount={unreadNotificationsCount}
            onClose={() => setIsSheetOpen(false)}
            onSignOut={handleSignOut}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onSearchSubmit={handleSearchSubmit}
            languageSwitcher={<LanguageSwitcher compact />}
            themeToggle={<ThemeToggle />}
          />
        </SheetContent>
      </div>
      </Sheet>
    </header>
  );
};
