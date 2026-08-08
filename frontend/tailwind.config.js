/** Tailwind — tokens de marca ManLab (§12). Tema oscuro por defecto. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        crema: '#F5F0E8',
        negro: '#0C0C0C',
        oro: '#D4A857',
        'oro-osc': '#A47E38',
        gris: '#8C8780',
      },
      fontFamily: {
        impacto: ['"Bebas Neue"', 'sans-serif'],   // títulos
        cuerpo: ['Inter', 'sans-serif'],            // UI / cuerpo
        editorial: ['"Cormorant Garamond"', 'serif'], // display editorial
      },
    },
  },
  plugins: [],
};
