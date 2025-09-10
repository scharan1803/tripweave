/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system","BlinkMacSystemFont","SF Pro Text","SF Pro Display",
          "Inter","Segoe UI","Roboto","Helvetica Neue","Arial","Noto Sans","sans-serif"
        ],
      },
    },
  },
  plugins: [],
};
