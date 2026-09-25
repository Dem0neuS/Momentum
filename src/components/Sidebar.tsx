import { motion } from 'framer-motion';
import { Logo } from './Logo';
import { NAV_ITEMS, type SectionId } from './navigation';
import { cn } from '@/lib/utils';

export function Sidebar({
  active,
  onNavigate,
}: {
  active: SectionId;
  onNavigate: (id: SectionId) => void;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border/50 bg-card/60 backdrop-blur-xl md:flex">
      <div className="flex h-16 items-center px-5">
        <Logo size={30} />
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === active;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-violet-500/15 to-blue-500/15 ring-1 ring-primary/20"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <Icon className={cn('relative z-10 h-[18px] w-[18px]', isActive && 'text-primary')} />
              <span className="relative z-10">{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="border-t border-border/50 p-4">
        <p className="text-xs text-muted-foreground">Твой день. Твой ритм. Твой прогресс.</p>
      </div>
    </aside>
  );
}