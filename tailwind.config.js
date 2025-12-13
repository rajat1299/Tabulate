/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6366f1',
          hover: '#4f46e5',
          light: '#a5b4fc',
        },
        surface: '#ffffff',
        background: '#fafafa',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        text: {
          primary: '#1a1a2e',
          secondary: '#64748b',
          muted: '#94a3b8',
        },
        border: '#e2e8f0',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '12px',
      },
      width: {
        popup: '400px',
      },
      height: {
        popup: '600px',
      },
    },
  },
  plugins: [],
}
