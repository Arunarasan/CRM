import animate from 'tailwindcss-animate'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1.25rem', lg: '2rem' },
      screens: { '2xl': '1360px' },
    },
    extend: {
      colors: {
        // JB Decor brand system: Forest Green + Luxury Gold + Warm Ivory
        forest: {
          DEFAULT: '#0B2B23', // primary dark green (header, hero overlay, footer)
          light: '#123D32',   // secondary panels, cards on dark, hover
          deep: '#071D18',    // deepest — footer, strong contrast
        },
        gold: {
          DEFAULT: '#D6A84F', // luxury gold accent, CTAs, highlights
          dark: '#B8903F',    // subtle borders, secondary accents
        },
        ivory: '#F7F3EA',     // warm ivory page background
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      letterSpacing: {
        eyebrow: '0.25em',
      },
      boxShadow: {
        card: '0 8px 30px -12px rgba(11, 43, 35, 0.18)',
        'card-hover': '0 20px 45px -18px rgba(11, 43, 35, 0.30)',
        header: '0 6px 24px -12px rgba(7, 29, 24, 0.45)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 0.6s ease-out both',
      },
    },
  },
  plugins: [animate],
}
