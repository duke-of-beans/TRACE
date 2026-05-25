/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        trace: {
          bg: "var(--bg)",
          surface: "var(--surface)",
          "surface-alt": "var(--surface-alt)",
          border: "var(--border)",
          accent: "var(--accent)",
          "accent-hover": "var(--accent-hover)",
          "accent-soft": "var(--accent-soft)",
          "accent-text": "var(--accent-text)",
          danger: "var(--danger)",
          "danger-soft": "var(--danger-soft)",
          warning: "var(--warning)",
          "warning-soft": "var(--warning-soft)",
          confirm: "var(--success)",
          "confirm-soft": "var(--success-soft)",
        },
      },
      textColor: {
        primary: "var(--text)",
        secondary: "var(--text-sec)",
        muted: "var(--text-muted)",
      },
      borderColor: {
        DEFAULT: "var(--border)",
        focus: "var(--border-focus)",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", '"Segoe UI"', "system-ui", "sans-serif"],
        mono: ['"SF Mono"', '"Cascadia Code"', '"Fira Code"', "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
