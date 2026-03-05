/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
            },
            colors: {
                slate: {
                    950: '#020617',
                    900: '#0f172a',
                    850: '#0e1829',
                    800: '#1e293b',
                    700: '#334155',
                    600: '#475569',
                    500: '#64748b',
                    400: '#94a3b8',
                    300: '#cbd5e1',
                    200: '#e2e8f0',
                    100: '#f1f5f9',
                },
            },
            backgroundOpacity: ['hover', 'focus'],
            backdropBlur: {
                xs: '2px',
                sm: '4px',
                md: '12px',
                lg: '16px',
                xl: '24px',
            },
            keyframes: {
                'fade-in': {
                    '0%': { opacity: '0', transform: 'translateY(4px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'slide-in': {
                    '0%': { opacity: '0', transform: 'translateX(-8px)' },
                    '100%': { opacity: '1', transform: 'translateX(0)' },
                },
            },
            animation: {
                'fade-in': 'fade-in 0.3s ease forwards',
                'slide-in': 'slide-in 0.3s ease forwards',
            },
            boxShadow: {
                'neon-green': '0 0 20px rgba(52, 211, 153, 0.3)',
                'neon-red': '0 0 20px rgba(244, 63, 94, 0.3)',
                'neon-indigo': '0 0 20px rgba(99, 102, 241, 0.3)',
            },
        },
    },
    plugins: [],
}
