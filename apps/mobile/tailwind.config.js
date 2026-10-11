const tema = require('../../packages/shared/src/tema.json');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: { lana: tema.lana, ok: tema.estado.ok, alerta: tema.estado.alerta, peligro: tema.estado.peligro, info: tema.estado.info },
    },
  },
  plugins: [],
};
