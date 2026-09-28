import { SettingsIcon } from 'lucide-react';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { Button } from './ui/button';
import { ProfileAvatar } from './ProfileAvatar';
import { useSettingsStore } from '@/store/settingsStore';
import { sectionTitle, type SectionId } from './navigation';

export function Header({
  section,
  onOpenProfile,
}: {
  section: SectionId;
  onOpenProfile: () => void;
}) {
  const profileName = useSettingsStore((s) => s.settings.profileName);
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border/50 bg-background/80 px-4 backdrop-blur-lg">
      <div className="flex items-center gap-2 md:hidden">
        <Logo size={26} showText={false} />
        <h1 className="truncate text-base font-semibold">{sectionTitle(section)}</h1>
      </div>
      <div className="hidden md:block">
        <h1 className="text-lg font-semibold">{sectionTitle(section)}</h1>
      </div>
      <div className="flex items-center gap-1.5">
        <ThemeToggle />
        {/* Шестерёнка ведёт в тот же профиль, а не в отдельный диалог. */}
        <Button variant="ghost" size="icon" onClick={onOpenProfile} title="Настройки" aria-label="Настройки">
          <SettingsIcon className="h-[18px] w-[18px]" />
        </Button>
        <ProfileAvatar name={profileName} onOpenProfile={onOpenProfile} />
      </div>
    </header>
  );
}