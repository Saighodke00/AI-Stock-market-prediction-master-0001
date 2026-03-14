/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                display: ['Outfit', 'sans-serif'],
                body: ['Inter', 'sans-serif'],
                data: ['Inter', 'monospace'],
            },
            colors: {
                // Backgrounds
                void: '#020408',
                base: '#050912',
                surface: '#0a101e',
                raised: '#11192a',
                overlay: '#182235',
                
                // Borders
                dim: 'rgba(255, 255, 255, 0.05)',
                mid: 'rgba(255, 255, 255, 0.1)',
                bright: 'rgba(255, 255, 255, 0.2)',
                
                // Text
                primary: '#f8fafc',
                secondary: '#94a3b8',
                muted: '#475569',
                
                // Accents
                cyan: {
                    DEFAULT: '#00d2ff',
                    400: '#22d3ee',
                    500: '#06b6d4',
                    glow: 'rgba(0, 210, 255, 0.4)',
                },
                emerald: {
                    DEFAULT: '#10b981',
                    400: '#34d399',
                    500: '#10b981',
                    glow: 'rgba(16, 185, 129, 0.4)',
                },
                rose: {
                    DEFAULT: '#f43f5e',
                    400: '#fb7185',
                    500: '#f43f5e',
                    glow: 'rgba(244, 63, 94, 0.4)',
                },
                amber: {
                    DEFAULT: '#f59e0b',
                    400: '#fbbf24',
                    500: '#f59e0b',
                    glow: 'rgba(245, 158, 11, 0.4)',
                },
                indigo: {
                    DEFAULT: '#6366f1',
                    400: '#818cf8',
                    500: '#6366f1',
                    glow: 'rgba(99, 102, 241, 0.4)',
                },
            },
            boxShadow: {
                'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
                'glass-inset': 'inset 0 0 0 1px rgba(255, 255, 255, 0.1)',
            },
            backdropBlur: {
                'xs': '2px',
            }
        },
    },
    plugins: [],
}
