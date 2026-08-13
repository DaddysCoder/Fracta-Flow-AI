/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Fracta Flow brand tokens — mirrors the :root CSS variables in
      // src/index.css. Source of truth is fracta_flow_brand_kit.pdf,
      // confirmed against the actual file (§3, §4, §5, §7) — these
      // values are copied verbatim from it, not approximated.
      colors: {
        brand: {
          purple: "#7B2FF7",
          ink: "#111111",
          paper: "#FFFFFF",
          surface: "#F5F5F5",
          border: "#E5E5E5",
          muted: "#6B6B6B",
        },
      },
      fontFamily: {
        display: ["Montserrat", "sans-serif"],
        body: ["Nunito", "sans-serif"],
      },
      spacing: {
        "brand-1": "8px",
        "brand-2": "16px",
        "brand-3": "24px",
        "brand-4": "32px",
        "brand-5": "48px",
        "brand-6": "64px",
        "brand-7": "96px",
      },
      borderRadius: {
        brand: "8px",
      },
      boxShadow: {
        none: "none",
      },
      maxWidth: {
        // §4: cap body paragraphs around 60–75 characters per line —
        // matches the reference landing page's own `prose` token.
        prose: "68ch",
      },
    },
  },
  plugins: [],
};
