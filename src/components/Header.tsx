import { SettingsIcon } from 'lucide-react';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { Button } from './ui/button';
import { sectionTitle, type SectionId } from './navigation';

export function Header({
  section,
  onOpenSettings,
}: {
  section: SectionId;
  onOpenSettings: () => void;
}) {
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
        <Button variant="ghost" size="icon" onClick={onOpenSettings} title="Настройки" aria-label="Настройки">
          <SettingsIcon className="h-[18px] w-[18px]" />
        </Button>
      </div>
    </header>
  );
}