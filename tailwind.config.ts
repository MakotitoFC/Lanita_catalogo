import type { Config } from 'tailwindcss';
import tema from '../../packages/shared/src/tema.json';

// Cada tono lee su valor de una variable CSS ("R G B") que el layout inyecta según los colores configurados en el APK.
const escala = Object.fromEntries(Object.keys(tema.lana).map((k) => [k, `rgb(var(--lana-${k}) / <alpha-value>)`]));

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        lana: escala,
        acento: 'rgb(var(--acento) / <alpha-value>)',
        claro: 'rgb(var(--claro) / <alpha-value>)',
        precio: '#74784a', // color fijo del precio
        foto: '#f2f2f2', // fondo de las tarjetas de producto y de las fotos
        ok: tema.estado.ok, alerta: tema.estado.alerta, peligro: tema.estado.peligro,
      },
      fontFamily: {
        script: ['var(--font-manuscrita)', 'cursive'],
        sans: ['var(--font-poppins)', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['var(--font-poppins)', 'system-ui', 'sans-serif'], // todo el sitio usa Poppins
      },
    },
  },
  plugins: [],
};
export default config;
