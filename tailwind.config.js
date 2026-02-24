/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['var(--font-playfair)', 'Georgia', 'serif'],
      },
      colors: {
        brand: {
          cream: '#F5F0EB',
          'cream-light': '#FAF5EF',
          orange: '#EA580C',   // orange-600
          teal: '#0F766E',     // teal-700
          dark: '#111827',
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
