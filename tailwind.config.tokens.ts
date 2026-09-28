/**
 * Momentum · мост между CSS-токенами и Tailwind.
 *
 * Файл импортируется из tailwind.config.js и добавляется в theme.extend.
 * Цвета используют RGB-каналы из momentum-tokens.css, поэтому сохраняются
 * модификаторы прозрачности вида bg-card/60 и text-primary/80.
 */
import type { Config } from 'tailwindcss';

const rgb = (token: string) => `rgb(var(${token}) / <alpha-value>)`;

const tokens: Partial<Config> = {
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        transparent: 'transparent',
        current: 'currentColor',
        inherit: 'inherit',

        /* Новые семантические имена */
        bg: rgb('--bg-rgb'),
        surface: rgb('--surface-rgb'),
        'surface-2': rgb('--surface-2-rgb'),
        'surface-3': rgb('--surface-3-rgb'),
        border: rgb('--border-rgb'),
        'border-strong': rgb('--border-strong-rgb'),
        content: rgb('--text-rgb'),
        dim: rgb('--text-dim-rgb'),

        /* Совместимость с существующими shadcn-подобными классами */
        background: rgb('--bg-rgb'),
        foreground: rgb('--text-rgb'),
        input: rgb('--border-strong-rgb'),
        ring: rgb('--brand-rgb'),
        primary: {
          DEFAULT: rgb('--brand-rgb'),
          foreground: rgb('--on-brand-rgb'),
          ink: rgb('--primary-ink-rgb'),
        },
        secondary: {
          DEFAULT: rgb('--surface-2-rgb'),
          foreground: rgb('--text-rgb'),
        },
        muted: {
          DEFAULT: rgb('--surface-2-rgb'),
          foreground: rgb('--text-muted-rgb'),
        },
        accent: {
          DEFAULT: rgb('--surface-3-rgb'),
          foreground: rgb('--text-rgb'),
        },
        destructive: {
          DEFAULT: rgb('--danger-rgb'),
          foreground: rgb('--on-solid-rgb'),
          ink: rgb('--danger-ink-rgb'),
        },
        popover: {
          DEFAULT: rgb('--surface-rgb'),
          foreground: rgb('--text-rgb'),
        },
        card: {
          DEFAULT: rgb('--surface-rgb'),
          foreground: rgb('--text-rgb'),
        },

        brand: {
          DEFAULT: rgb('--brand-rgb'),
          50: 'var(--brand-50)',
          100: 'var(--brand-100)',
          300: 'var(--brand-300)',
          400: 'var(--brand-400)',
          500: rgb('--brand-rgb'),
          600: 'var(--brand-600)',
          700: 'var(--brand-700)',
        },
        flow: {
          DEFAULT: rgb('--flow-rgb'),
          400: 'var(--flow-400)',
          500: rgb('--flow-rgb'),
          600: 'var(--flow-600)',
        },
        done: {
          DEFAULT: rgb('--done-rgb'),
          soft: 'var(--done-soft)',
          ink: rgb('--done-ink-rgb'),
        },
        skip: {
          DEFAULT: rgb('--skip-rgb'),
          soft: 'var(--skip-soft)',
          ink: rgb('--skip-ink-rgb'),
        },
        miss: rgb('--miss-rgb'),
        danger: {
          DEFAULT: rgb('--danger-rgb'),
          soft: 'var(--danger-soft)',
          ink: rgb('--danger-ink-rgb'),
        },
        strength: {
          DEFAULT: rgb('--strength-rgb'),
          soft: 'var(--strength-soft)',
          ink: rgb('--strength-ink-rgb'),
        },
        cardio: {
          DEFAULT: rgb('--cardio-rgb'),
          soft: 'var(--cardio-soft)',
          ink: rgb('--cardio-ink-rgb'),
        },
        info: {
          DEFAULT: rgb('--info-rgb'),
          soft: 'var(--info-soft)',
          ink: rgb('--info-ink-rgb'),
        },
        stretch: {
          DEFAULT: rgb('--stretch-rgb'),
          soft: 'var(--stretch-soft)',
          ink: rgb('--stretch-ink-rgb'),
        },
        other: {
          DEFAULT: rgb('--other-rgb'),
          soft: 'var(--other-soft)',
          ink: rgb('--other-ink-rgb'),
        },

        /* Псевдонимы, которые уже используются интерфейсом */
        success: {
          DEFAULT: rgb('--done-rgb'),
          foreground: rgb('--on-solid-rgb'),
          ink: rgb('--done-ink-rgb'),
        },
        warning: {
          DEFAULT: rgb('--warning-rgb'),
          foreground: rgb('--on-solid-rgb'),
          ink: rgb('--warning-ink-rgb'),
          soft: 'var(--warning-soft)',
        },
        navy: rgb('--navy-rgb'),
        'on-brand': rgb('--on-brand-rgb'),
        'on-solid': rgb('--on-solid-rgb'),
        overlay: 'var(--overlay)',
      },

      backgroundImage: {
        'gradient-brand': 'var(--grad-brand)',
        hero: 'var(--grad-hero)',
      },

      borderRadius: {
        xs: 'var(--r-xs)',
        sm: 'var(--r-sm)',
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
        xl: 'var(--r-xl)',
        '2xl': 'var(--r-2xl)',
        '3xl': 'var(--r-3xl)',
        pill: 'var(--r-pill)',
      },

      spacing: {
        tap: 'var(--tap-min)',
        row: 'var(--list-row)',
        field: 'var(--input-h)',
        nav: 'var(--nav-item-h)',
      },

      fontFamily: {
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)',
      },

      fontSize: {
        display: ['var(--fs-display)', { lineHeight: 'var(--lh-display)', fontWeight: '800', letterSpacing: '-0.02em' }],
        h1: ['var(--fs-h1)', { lineHeight: 'var(--lh-h1)', fontWeight: '700', letterSpacing: '-0.01em' }],
        h2: ['var(--fs-h2)', { lineHeight: 'var(--lh-h2)', fontWeight: '700' }],
        h3: ['var(--fs-h3)', { lineHeight: 'var(--lh-h3)', fontWeight: '600' }],
        body: ['var(--fs-body)', { lineHeight: 'var(--lh-body)' }],
        caption: ['var(--fs-caption)', { lineHeight: 'var(--lh-caption)', fontWeight: '500' }],
        micro: ['var(--fs-micro)', { lineHeight: 'var(--lh-micro)', fontWeight: '700', letterSpacing: '0.08em' }],
      },

      boxShadow: {
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
        focus: 'var(--focus-ring)',
      },

      transitionTimingFunction: {
        smooth: 'var(--ease)',
      },
      transitionDuration: {
        micro: 'var(--dur-micro)',
        base: 'var(--dur-base)',
        panel: 'var(--dur-panel)',
      },

      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(12px) scale(.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'ring-fill': {
          from: { strokeDashoffset: 'var(--ring-total)' },
          to: { strokeDashoffset: 'var(--ring-offset)' },
        },
      },
      animation: {
        'fade-in': 'fade-in var(--dur-base) var(--ease) both',
        'slide-up': 'slide-up var(--dur-base) var(--ease) both',
        'toast-in': 'toast-in var(--dur-panel) var(--ease) both',
        'ring-fill': 'ring-fill 600ms var(--ease) both',
      },
    },
  },
};

export default tokens;
