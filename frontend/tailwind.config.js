/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                display: ['Orbitron', 'sans-serif'],
                body: ['Rajdhani', 'sans-serif'],
                data: ['Share Tech Mono', 'monospace'],
            },
            colors: {
                void: 'var(--bg-void)',
                base: 'var(--bg-base)',
                surface: 'var(--bg-surface)',
                raised: 'var(--bg-raised)',
                overlay: 'var(--bg-overlay)',
                dim: 'var(--border-dim)',
                mid: 'var(--border-mid)',
                bright: 'var(--border-bright)',
                cyan: 'var(--cyan)',
                'cyan-dim': 'var(--cyan-dim)',
                green: 'var(--green)',
                'green-dim': 'var(--green-dim)',
                red: 'var(--red)',
                'red-dim': 'var(--red-dim)',
                gold: 'var(--gold)',
                'gold-dim': 'var(--gold-dim)',
                violet: 'var(--violet)',
                'violet-dim': 'var(--violet-dim)',
                primary: 'var(--text-primary)',
                secondary: 'var(--text-secondary)',
                muted: 'var(--text-muted)',
            },
            boxShadow: {
                'glow-cyan': 'var(--cyan-glow)',
                'glow-green': 'var(--green-glow)',
                'glow-red': 'var(--red-glow)',
            },
            transitionTimingFunction: {
                'conf-ease': 'cubic-bezier(0.25, 1, 0.5, 1)',
            }
        },
    },
    plugins: [],
}
