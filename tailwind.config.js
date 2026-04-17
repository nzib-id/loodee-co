/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        dungeon: {
          bg: '#0a0a0f',
          panel: '#111118',
          border: '#1e1e2e',
          muted: '#2a2a3a',
        },
        loodee: '#7c6af7',
        code: '#38bdf8',
        research: '#f59e0b',
        creative: '#f472b6',
      },
      fontFamily: {
        mono: ['"Courier New"', 'Courier', 'monospace'],
      },
    },
  },
  plugins: [],
}
