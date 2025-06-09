import {heroui} from '@heroui/theme';
import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@heroui/theme/dist/components/(accordion|alert|autocomplete|avatar|badge|breadcrumbs|button|calendar|card|checkbox|chip|code|date-input|date-picker|divider|drawer|dropdown|form|image|input|input-otp|kbd|link|listbox|menu|modal|navbar|number-input|pagination|popover|progress|radio|ripple|scroll-shadow|select|skeleton|slider|snippet|spacer|spinner|toggle|table|tabs|toast|user).js"
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          50: "#f5e1df",
          100: "#e6b6b3",
          200: "#d88c87",
          300: "#ca615b",
          400: "#bb372e",
          500: "#ad0c02",
          600: "#8f0a02",
          700: "#700801",
          800: "#520601",
          900: "#340401",
          foreground: "#fff",
          DEFAULT: "#ad0c02"
        },
        secondary: {
          50: "#f7fdec",
          100: "#ecfbd1",
          200: "#e0f9b5",
          300: "#d5f79a",
          400: "#c9f47f",
          500: "#bef264",
          600: "#9dc853",
          700: "#7c9d41",
          800: "#5a7330",
          900: "#39491e",
          foreground: "#000",
          DEFAULT: "#bef264"
        },
        
      },
    },
  },
  darkmode: "class",
  plugins: [heroui()],
} satisfies Config;
