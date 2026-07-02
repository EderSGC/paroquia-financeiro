/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
      colors: {
        brand: {
          DEFAULT: "#3d4db3",
          soft: "#eef1ff",
          strong: "#2e3db2",
        },
      },
      boxShadow: {
        soft: "0 24px 80px rgba(15, 23, 42, 0.08)",
      },
    },
  },
  plugins: [],
}
