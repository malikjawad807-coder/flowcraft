/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0d1117',
        surface: {
          50: '#161b22',
          100: '#21262d',
          200: '#30363d',
          300: '#484f58',
          400: '#6e7681',
          500: '#8b949e',
        },
        brand: {
          50: '#fff1f2',
          100: '#ffe4e6',
          500: '#ff6d5a', // n8n coral-red accent
          600: '#ea580c',
          700: '#c2410c',
        },
        node: {
          trigger: '#059669', // Emerald
          ai: '#7c3aed', // Violet
          gmail: '#dc2626', // Red
          code: '#0284c7', // Sky
          logic: '#d97706', // Amber
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'flow': 'flow 1s linear infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        flow: {
          '0%': { strokeDashoffset: '24' },
          '100%': { strokeDashoffset: '0' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(255, 109, 90, 0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(255, 109, 90, 0.8)' },
        }
      }
    },
  },
  plugins: [],
};
