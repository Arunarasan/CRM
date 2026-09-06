/** @type {import('tailwindcss').Config} */

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * PREMIUM LUXURY THEME — Forest Green · Warm Ivory · Champagne Gold
 * ─────────────────────────────────────────────────────────────────────────────
 * The app was built with hundreds of raw Tailwind color utilities
 * (slate / emerald / amber / rose …). Rather than rewrite every screen, we
 * REMAP those default palettes onto the brand ramps below, so existing class
 * names keep working but render the luxury palette. Semantic tokens
 * (bg-primary, bg-card, border …) come from the CSS variables in index.css.
 *
 *   neutrals  (slate/gray/zinc/neutral/stone) → warm ivory / stone
 *   greens    (emerald/green/teal/lime)        → forest green (+ success mid-tones)
 *   golds     (amber/yellow/orange)            → champagne gold
 *   dangers   (red/rose/pink)                  → muted terracotta red
 *   infos     (blue/sky/cyan/indigo/violet/purple) → muted slate blue
 */

// Warm neutral ramp — replaces the cool default grays.
const neutral = {
  50:  "#FAF9F6",
  100: "#F2F1EC",
  200: "#E7E4DD",
  300: "#D9D6CE",
  400: "#B4B1A8",
  500: "#858985",
  600: "#5D625F",
  700: "#434845",
  800: "#232B27",
  900: "#111817",
  950: "#0A0F0E",
};

// Forest-green ramp — deep at the top, success-green through the middle.
const forest = {
  50:  "#F2F8F5",
  100: "#E8F3EE",
  200: "#CFE7DB",
  300: "#A5D0BC",
  400: "#5AA982",
  500: "#2F8F65", // success
  600: "#0A573B", // medium green
  700: "#06452F", // forest green
  800: "#003522", // deep forest
  900: "#012316", // primary dark
  950: "#011C11",
};

// Champagne-gold ramp — the accent.
const gold = {
  50:  "#FCF7EC",
  100: "#F8EACF", // pale gold background
  200: "#F0D19B", // champagne
  300: "#D9B06B", // light gold
  400: "#C9A05A",
  500: "#BC8748", // primary gold
  600: "#9B6B32", // dark gold
  700: "#85592A",
  800: "#6E4A24",
  900: "#573A1E",
  950: "#3A2613",
};

// Muted danger ramp — terracotta, never neon.
const danger = {
  50:  "#FBE9E8",
  100: "#F7DAD8",
  200: "#EFB8B6",
  300: "#E29290",
  400: "#CE6A68",
  500: "#B94A48", // danger
  600: "#9B4644", // cancelled text
  700: "#833A38",
  800: "#6B302F",
  900: "#562726",
  950: "#3A1918",
};

// Muted info ramp — slate blue for site / project cues.
const info = {
  50:  "#EAF1F8",
  100: "#DCE8F3",
  200: "#BDD1E6",
  300: "#93B3D3",
  400: "#6B94BE",
  500: "#4779A8", // info
  600: "#3A6690",
  700: "#315579",
  800: "#294663",
  900: "#233A52",
  950: "#17273A",
};

module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: [
          "Inter", "Manrope", "ui-sans-serif", "system-ui", "-apple-system",
          "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif",
        ],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        gold: {
          DEFAULT: "hsl(var(--gold))",
          foreground: "hsl(var(--gold-foreground))",
          light: "#D9B06B",
          dark: "#9B6B32",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // ── Brand ramps remapped onto Tailwind's default palette names ──
        slate: neutral,
        gray: neutral,
        zinc: neutral,
        neutral: neutral,
        stone: neutral,

        emerald: forest,
        green: forest,
        teal: forest,
        lime: forest,

        amber: gold,
        yellow: gold,
        orange: gold,

        red: danger,
        rose: danger,
        pink: danger,

        blue: info,
        sky: info,
        cyan: info,
        indigo: info,
        violet: info,
        purple: info,
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "14px",
        "2xl": "18px",
      },
      boxShadow: {
        sm: "0 2px 8px rgba(0, 35, 22, 0.04)",
        DEFAULT: "0 3px 14px rgba(0, 35, 22, 0.05)",
        md: "0 4px 14px rgba(0, 35, 22, 0.06)",
        lg: "0 12px 35px rgba(0, 35, 22, 0.10)",
        xl: "0 15px 45px rgba(0, 35, 22, 0.15)",
        gold: "0 4px 12px rgba(80, 55, 20, 0.12)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
