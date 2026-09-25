import { cn } from '@/lib/utils';
import { EMOJI_PALETTE } from '@/lib/constants';

export function EmojiPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (emoji: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {EMOJI_PALETTE.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onChange(emoji)}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-all hover:bg-accent',
            value === emoji && 'bg-accent ring-2 ring-primary/50',
          )}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}