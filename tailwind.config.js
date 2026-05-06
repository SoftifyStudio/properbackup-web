/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#f5f5f5',
        panel:   '#ffffff',
        sidebar: '#fafafa',
        border:  '#e5e7eb',
        accent:  '#0f6cbd',
        accentHover: '#115ea3',
        accentLight: '#ebf3fb',
        accentText:  '#0f6cbd',
        success: '#107c10',
        successLight: '#dff6dd',
        warn:    '#c47f17',
        warnLight: '#fff4ce',
        danger:  '#c50f1f',
        dangerLight: '#fde7e9',
        text1:   '#1a1a1a',
        text2:   '#424242',
        text3:   '#666666',
        text4:   '#999999',
      },
      fontFamily: {
        sans: ['"Segoe UI"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        card: '0 2px 8px 0 rgba(0,0,0,0.06)',
        cardHover: '0 4px 16px 0 rgba(0,0,0,0.10)',
        modal: '0 8px 40px 0 rgba(0,0,0,0.18)',
      },
      borderRadius: {
        xl2: '12px',
      },
      keyframes: {
        'agent-index-bar': {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(350%)' },
        },
      },
      animation: {
        'agent-index-bar': 'agent-index-bar 1.35s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
