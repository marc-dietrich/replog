/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#D4AF37",
        "primary-muted": "#EFDFA5",
        "background-light": "#F8F9FA",
        "background-dark": "#121212",
        "card-light": "#FFFFFF",
        "card-dark": "#1E1E1E",
      },
      fontFamily: {
        display: ["Outfit", "Inter", "sans-serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui"],
      },
      borderRadius: {
        xl: "1.25rem",
        "2xl": "1.75rem",
      },
      boxShadow: {
        sheet: "0 -32px 60px rgb(15 23 42 / 0.35)",
      },
    },
  },
  plugins: [],
};

