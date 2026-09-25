import { cn } from '@/lib/utils';
import { COLOR_PALETTE } from '@/lib/constants';
import { Check } from 'lucide-react';

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLOR_PALETTE.map((color) => {
        const active = value === color;
        return (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:scale-110',
              active && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
            )}
            style={{ backgroundColor: color }}
            aria-label={`Цвет ${color}`}
          >
            {active && <Check className="h-4 w-4 text-white" />}
          </button>
        );
      })}
    </div>
  );
}

export function getContrastColor(hex: string): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#0F172A' : '#FFFFFF';
}