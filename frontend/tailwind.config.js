/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#F7F4ED',
        sage: {
          DEFAULT: '#5C8A6B',
          dark: '#4A7059',
          light: '#EAF1EC',
        },
        terracotta: '#C4664A',
        clay: '#D4896E',
        'text-primary': '#2C2C2C',
        'text-secondary': '#8E8E8E',
      },
      borderRadius: {
        card: '20px',
        button: '16px',
      },
      boxShadow: {
        card: '0 4px 16px rgba(44,44,44,0.08)',
        'card-sm': '0 2px 8px rgba(44,44,44,0.06)',
      },
    },
  },
  plugins: [],
}
