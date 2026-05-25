import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/marketing/**/*.{html,ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
        display: ['"Inter Tight"', 'Inter', 'sans-serif'],
      },
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        border: 'var(--border)',
        card: 'var(--card)',
        signal: {
          DEFAULT: 'var(--signal)',
          foreground: 'var(--signal-foreground)',
        },
        violet: 'var(--violet)',
        cyan: 'var(--cyan)',
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        graphite: 'var(--graphite)',
        'graphite-2': 'var(--graphite-2)',
        'evidence-good': 'var(--evidence-good)',
        'evidence-warn': 'var(--evidence-warn)',
        'evidence-bad': 'var(--evidence-bad)',
      },
      boxShadow: {
        signal:
          '0 0 80px -20px rgb(239 17 126 / 0.40), 0 1px 0 rgb(239 17 126 / 0.08) inset',
        card: '0 1px 0 oklch(1 0 0 / 0.04) inset, 0 30px 60px -30px oklch(0 0 0 / 0.7)',
      },
    },
  },
  plugins: [],
  safelist: [
    // Marketing HTML uses dynamic class strings the scanner can miss.
    {
      pattern: /^(bg|text|border)-(signal|cyan|violet|evidence-good|evidence-warn|evidence-bad|graphite|graphite-2)(\/[0-9]+)?$/,
      variants: ['hover', 'focus'],
    },
  ],
};

export default config;
