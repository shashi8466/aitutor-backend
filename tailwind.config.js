/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enable manual dark mode via class
  theme: {
    extend: {
      fontFamily: {
        // Inter is already preloaded in index.html (weights 400-900) but was never wired
        // into the default sans stack, so `font-sans` was silently falling back to the OS
        // system font instead - the actual cause of text looking thin/generic.
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        jakarta: ['"Plus Jakarta Sans"', 'sans-serif'],
        archivo: ['"Archivo Black"', 'sans-serif'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
