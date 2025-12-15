/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Light mode - Warm neutral palette
        ink: {
          DEFAULT: '#1C1917',
          secondary: '#57534E',
          tertiary: '#A8A29E',
          faint: '#D6D3D1',
        },
        canvas: {
          DEFAULT: '#FFFFFF',
          subtle: '#FAFAF9',
          muted: '#F5F5F4',
        },
        // Dark mode overrides via CSS variables
        accent: {
          DEFAULT: '#14B8A6',      // Teal 500
          hover: '#0D9488',        // Teal 600
          subtle: '#042F2E',       // Teal 950 (dark bg)
          muted: '#134E4A',        // Teal 900
        },
        stroke: {
          DEFAULT: '#E7E5E4',
          hover: '#D6D3D1',
        },
        state: {
          success: '#10B981',      // Emerald 500
          warning: '#F59E0B',      // Amber 500
          error: '#EF4444',        // Red 500
        },
        // Workspace colors (matching Chrome tab group colors)
        workspace: {
          grey: '#9CA3AF',
          blue: '#3B82F6',
          red: '#EF4444',
          yellow: '#F59E0B',
          green: '#22C55E',
          pink: '#EC4899',
          purple: '#A855F7',
          cyan: '#06B6D4',
          orange: '#F97316',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
        xs: ['0.75rem', { lineHeight: '1.125rem' }],
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],
        base: ['0.875rem', { lineHeight: '1.375rem' }],
        lg: ['1rem', { lineHeight: '1.5rem' }],
        xl: ['1.125rem', { lineHeight: '1.75rem' }],
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '10px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgb(0 0 0 / 0.03)',
        'soft': '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        'lifted': '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
        'elevated': '0 10px 15px -3px rgb(0 0 0 / 0.05), 0 4px 6px -4px rgb(0 0 0 / 0.05)',
        // Dark mode shadows
        'soft-dark': '0 1px 3px 0 rgb(0 0 0 / 0.2), 0 1px 2px -1px rgb(0 0 0 / 0.2)',
        'lifted-dark': '0 4px 6px -1px rgb(0 0 0 / 0.3), 0 2px 4px -2px rgb(0 0 0 / 0.2)',
      },
      width: {
        popup: '420px',
      },
      height: {
        popup: '580px',
      },
      spacing: {
        '4.5': '1.125rem',
        '13': '3.25rem',
      },
      transitionDuration: {
        '150': '150ms',
        '200': '200ms',
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease-out',
        'slide-up': 'slideUp 250ms ease-out',
        'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
}
