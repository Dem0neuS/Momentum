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
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-card/90 backdrop-blur-xl md:hidden">
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === active;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="bottomnav-active"
                  className="absolute top-0 h-0.5 w-8 rounded-full bg-gradient-to-r from-violet-500 to-blue-500"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <Icon className="h-5 w-5" />
              <span>{item.shortLabel}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}