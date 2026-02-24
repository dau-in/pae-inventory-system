/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['Outfit', 'sans-serif'],
      },
      colors: {
        pae: {
          peach: '#FFD9A8',
          'peach-light': '#FFF7ED',
          'peach-dark': '#FDBA74',
          'pot-dark': '#1C1917',
          'pot-light': '#9CA3AF'
        }
      }
    },
  },
  plugins: [],
}
