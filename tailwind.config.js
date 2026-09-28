import tokens from './tailwind.config.tokens.ts';
import tailwindcssAnimate from 'tailwindcss-animate';

const tokenExtend = tokens.theme?.extend ?? {};

export default {
  darkMode: tokens.darkMode,
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      ...tokenExtend,
      boxShadow: {
        ...tokenExtend.boxShadow,
        soft: 'var(--shadow-card)',
        'soft-lg': 'var(--shadow-pop)',
      },
      keyframes: {
        ...tokenExtend.keyframes,
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        ...tokenExtend.animation,
        'accordion-down': 'accordion-down var(--dur-panel) var(--ease)',
        'accordion-up': 'accordion-up var(--dur-panel) var(--ease)',
        'scale-in': 'scale-in var(--dur-micro) var(--ease)',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
