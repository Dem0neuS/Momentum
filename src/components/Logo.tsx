import * as React from 'react';

/**
 * Знак Momentum: сквиркл с сегментным кольцом из восьми дуг.
 *
 * Геометрия повторяет public/icons/momentum-logo.svg один в один
 * (r=142, обводка 38, шаг 62 / 49.53, смещение 254.03), поэтому знак в
 * шапке и установленная иконка — один и тот же рисунок. Цвета берутся из
 * токенов, а не из констант: --brand-gradient-start / --brand-gradient-end
 * совпадают со стопами градиента в SVG.
 *
 * Пропорции нельзя править по отдельности от иконки: дуги рассчитаны на
 * скруглённые торцы, и при сужении обводки зазоры между ними сойдутся в
 * сплошное кольцо (подробнее — в scripts/build-icons.mjs).
 */
export function LogoIcon({ size = 28 }: { size?: number }) {
  const rawId = React.useId();
  const gradientId = `mm-gradient-${rawId.replace(/:/g, '')}`;

  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="var(--brand-gradient-start)" />
          <stop offset="0.55" stopColor="var(--brand-500)" />
          <stop offset="1" stopColor="var(--brand-gradient-end)" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="118" ry="118" fill="var(--navy)" />
      <circle
        cx="256"
        cy="256"
        r="142"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="38"
        strokeLinecap="round"
        strokeDasharray="62 49.53"
        strokeDashoffset="254.03"
      />
    </svg>
  );
}

export function Logo({ size = 30, showText = true }: { size?: number; showText?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoIcon size={size} />
      {showText && (
        <span className="text-lg font-bold leading-none tracking-tight">
          <span className="gradient-text">Momentum</span>
        </span>
      )}
    </div>
  );
}
