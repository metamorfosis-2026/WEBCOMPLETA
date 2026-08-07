const defaultTheme = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', ...defaultTheme.fontFamily.sans],
        display: ['var(--font-display)', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        // Texto en blanco frío (no puro) para acompañar el celeste.
        ivory: '#E9F1F7',
        celeste: '#7CC9EC',
        'celeste-deep': '#3E9FCB',
        sand: '#E4C89C',
        night: '#04070E',
      },
      maxWidth: {
        prose: '60ch',
      },
    },
  },
  plugins: [],
};
