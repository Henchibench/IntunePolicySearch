import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: ['"Segoe UI Variable"', '"Segoe UI"', "-apple-system", "BlinkMacSystemFont", "Roboto", '"Helvetica Neue"', "Arial", "sans-serif"],
      },
      colors: {
        canvas: "hsl(var(--canvas))",
        lifted: "hsl(var(--lifted))",
        "pure-white": "hsl(var(--pure-white))",
        ink: "hsl(var(--ink))",
        charcoal: "hsl(var(--charcoal))",
        slate: "hsl(var(--slate))",
        dust: "hsl(var(--dust))",
        signal: {
          DEFAULT: "hsl(var(--signal))",
          light: "hsl(var(--signal-light))",
        },
        clay: "hsl(var(--clay))",
        link: "hsl(var(--link))",

        /* shadcn-compatible aliases */
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        surface: { DEFAULT: "hsl(var(--surface))", foreground: "hsl(var(--surface-foreground))" },
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))", glow: "hsl(var(--primary-glow))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        success: { DEFAULT: "hsl(var(--success))", foreground: "hsl(var(--success-foreground))" },
        warning: { DEFAULT: "hsl(var(--warning))", foreground: "hsl(var(--warning-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))", hover: "hsl(var(--card-hover))" },
      },
      borderRadius: {
        sm: "0.125rem",
        md: "0.25rem",
        lg: "var(--radius)",
        xl: "0.375rem",
        "2xl": "var(--radius-card)",
        "3xl": "var(--radius-frame)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        /* Fluent 2 two-part shadows (ambient ring + key drop) */
        pill: "0 0 2px rgba(0,0,0,0.12), 0 8px 16px rgba(0,0,0,0.14)",
        "pill-light": "0 0 2px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.14)",
        drawer: "0 0 8px rgba(0,0,0,0.12), 0 32px 64px rgba(0,0,0,0.14)",
        "drawer-light": "0 0 8px rgba(0,0,0,0.12), 0 32px 64px rgba(0,0,0,0.14)",
        card: "0 0 2px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.14)",
      },
      letterSpacing: {
        eyebrow: "0.08em",
        tight2: "-0.02em",
        tight3: "-0.03em",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
