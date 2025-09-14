import type { Config } from 'tailwindcss';

const config: Config = {
    content: [
        './src/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
            },
            colors: {
                teal: {
                    600: '#0d9488',
                    700: '#0f766e',
                    800: '#115e59',
                },
            },
        },
    },
    plugins: [],
};
export default config;