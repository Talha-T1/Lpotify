/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'lpotify': {
          'green': '#1DB954',
          'green-light': '#1ed760',
          'black': '#000000',
          'dark': '#121212',
          'gray-dark': '#181818',
          'gray': '#282828',
          'gray-light': '#b3b3b3',
          'white': '#ffffff',
          'sidebar': '#000000',
          'card': '#181818',
          'hover': '#282828',
        }
      },
      fontFamily: {
        'spotify': ['Circular', 'Helvetica', 'Arial', 'sans-serif'],
      },
      animation: {
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'bounce-subtle': 'bounceSubtle 0.6s ease-in-out',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
      },
    },
  },
  plugins: [],
}
