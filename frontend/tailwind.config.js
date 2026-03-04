/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                emerald: {
                    400: '#34d399',
                    500: '#10b981',
                },
                indigo: {
                    400: '#818cf8',
                    500: '#6366f1',
                },
            },
        },
    },
    plugins: [],
}
