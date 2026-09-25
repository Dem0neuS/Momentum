import { motion } from 'framer-motion';
import { LogoIcon } from './Logo';
import { BRAND } from '@/lib/constants';

export function SplashScreen() {
  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-navy"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.45, ease: 'easeInOut' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        <LogoIcon size={88} />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        className="text-center"
      >
        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          <span className="gradient-text">Momentum</span>
        </h1>
        <p className="mt-2 text-sm text-slate-400">Твой день. Твой ритм. Твой прогресс.</p>
      </motion.div>
      <motion.div
        className="mt-4 flex gap-1.5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-violet-500 to-blue-500"
            animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
          />
        ))}
      </motion.div>
    </motion.div>
  );
}

export const SPLASH_DURATION = 1700;