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
          foreground: "var(--primary-foreground)",
          DEFAULT: "var(--primary)"
        },
        secondary: {
          foreground: "var(--secondary-foreground)",
          DEFAULT: "var(--secondary)"
        },
        warning: {
          foreground: "var(--warning-foreground)",
          DEFAULT: "var(--warning)"
        },
        danger: {
          foreground: "var(--danger-foreground)",
          DEFAULT: "var(--danger)"
        },
        success: {
          foreground: "var(--success-foreground)",
          DEFAULT: "var(--success)"
        },        
      },
    },
  },
  darkMode: "class",
  plugins: [heroui()],
} satisfies Config;
