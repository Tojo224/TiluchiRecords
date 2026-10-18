/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fdf4f3',
          500: '#e04f37',
          600: '#c53822',
          900: '#2b100b',
        }
      }
    },
  },
  plugins: [],
}
