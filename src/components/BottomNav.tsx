import { motion } from 'framer-motion';
import { NAV_ITEMS, type SectionId } from './navigation';
import { cn } from '@/lib/utils';

export function BottomNav({
  active,
  onNavigate,
}: {
  active: SectionId;
  onNavigate: (id: SectionId) => void;
}) {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur-xl md:hidden">
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === active;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative flex min-h-nav flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                isActive ? 'text-on-brand' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="bottomnav-active"
                  aria-hidden
                  className="absolute inset-x-2 inset-y-1 rounded-lg bg-gradient-brand shadow-card"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <Icon className="relative z-10 h-5 w-5" />
              <span className="relative z-10">{item.shortLabel}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}