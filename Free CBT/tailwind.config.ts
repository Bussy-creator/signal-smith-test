import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#1E4FDE",
          dark: "#132F8A",
          light: "#E8EDFF"
        }
      }
    }
  },
  plugins: []
};
export default config;
