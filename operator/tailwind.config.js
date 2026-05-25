/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        trace: {
          bg: "#0f0f1a",
          surface: "#1a1a2e",
          border: "#2a2a3e",
          accent: "#4fc3f7",
          danger: "#e74c3c",
          warning: "#f39c12",
          confirm: "#27ae60",
        },
      },
    },
  },
  plugins: [],
};
