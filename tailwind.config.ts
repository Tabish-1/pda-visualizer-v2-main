import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        surface2: "var(--surface2)",
        border: "var(--border)",
        text: "var(--text)",
        text2: "var(--text2)",
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        green: "var(--green)",
        red: "var(--red)",
        yellow: "var(--yellow)",
        cyan: "var(--cyan)",
        purple: "var(--purple)",
        orange: "var(--orange)",
      },
      fontFamily: {
        ui: 'var(--font-ui)',
        code: 'var(--font-code)',
      },
      borderRadius: {
        panel: 'var(--radius-panel)',
        btn: 'var(--radius-btn)',
      },
      animation: {
        spin: 'spin 0.8s linear infinite',
        pushIn: 'pushIn 0.3s ease',
        popOut: 'popOut 0.3s ease',
      },
      keyframes: {
        spin: {
          to: { transform: 'rotate(360deg)' },
        },
        pushIn: {
          from: { transform: 'translateY(-10px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        popOut: {
          from: { transform: 'scale(1)', opacity: '1' },
          to: { transform: 'scale(0.8)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
