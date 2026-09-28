import { cn } from '@/lib/utils';
import { EMOJI_PALETTE } from '@/lib/constants';

export function EmojiPicker({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string;
  onChange: (emoji: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {EMOJI_PALETTE.map((emoji, index) => (
        <button
          id={index === 0 ? id : undefined}
          key={emoji}
          type="button"
          onClick={() => onChange(emoji)}
          aria-label={`Выбрать эмодзи ${emoji}`}
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-lg text-lg transition-all hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:h-9 sm:w-9',
            value === emoji && 'bg-accent ring-2 ring-primary/50',
          )}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}