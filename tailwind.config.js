/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        pink: { DEFAULT: '#FF0D64', 50: '#fff0f5', 100: '#ffd6e6', 500: '#FF0D64' },
        teal: { DEFAULT: '#3FEACE', 50: '#f0fdfa', 500: '#3FEACE' },
        amber: { DEFAULT: '#FFA71A' },
        sidebar: '#0F1117',
        surface: '#161B27',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
