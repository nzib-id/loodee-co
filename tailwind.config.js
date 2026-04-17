/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        loodee: {
          bg: '#292929',
          yellow: '#ffe500',
          white: '#ffffff',
        },
        dungeon: {
          bg: '#0a0a0f',
          panel: '#111118',
          border: '#1e1e2e',
          muted: '#2a2a3a',
        },
        code: '#38bdf8',
        research: '#f59e0b',
        creative: '#f472b6',
      },
      fontFamily: {
        heading: ['"heading-font"', 'monospace'],
        body: ['"body-font"', 'monospace'],
        mono: ['"Courier New"', 'Courier', 'monospace'],
      },
      boxShadow: {
        brutal: '3px 3px 0 rgba(0,0,0,1)',
        'brutal-yellow': '3px 3px 0 #ffe500',
      },
    },
  },
  plugins: [],
}
