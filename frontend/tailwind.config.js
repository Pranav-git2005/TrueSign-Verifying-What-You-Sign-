/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        midnight: "#080B12",
        panel: "#101622",
        surface: "#151E2D",
        accent: "#42E8A4",
        muted: "#8995A8",
      },
      boxShadow: {
        glow: "0 0 30px rgba(66,232,164,0.10)",
      },
    },
  },
  plugins: [],
};
