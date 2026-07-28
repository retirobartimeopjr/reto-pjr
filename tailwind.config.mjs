/** @type {import('tailwindcss').Config} */
export default {
    content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
                serif: ['Playfair Display', 'Merriweather', 'ui-serif', 'serif'],
            },
            colors: {
                brand: {
                    DEFAULT: '#f8b134',
                    light: '#fbd07e',
                    dark: '#bf8418',
                },
                'bartimeo-red': {
                    DEFAULT: '#640010',
                    light: '#8a0016',
                    dark: '#3d000a',
                },
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'float': 'float 6s ease-in-out infinite',
                'heartbeat': 'heartbeat 1.5s ease-in-out infinite',
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-20px)' },
                },
                heartbeat: {
                    '0%, 100%': { transform: 'scale(1)' },
                    '14%': { transform: 'scale(1.05)' },
                    '28%': { transform: 'scale(1)' },
                    '42%': { transform: 'scale(1.05)' },
                    '70%': { transform: 'scale(1)' },
                }
            },
            boxShadow: {
                'glow': '0 0 20px rgba(248, 177, 52, 0.5)',
                'glow-strong': '0 0 35px rgba(248, 177, 52, 0.7)',
            }
        },
    },
    plugins: [
        // @ts-ignore
        require('@tailwindcss/typography')
    ],
}
