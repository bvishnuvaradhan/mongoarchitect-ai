/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx}"] ,
  theme: {
    extend: {
      fontFamily: {
        display: ["Fraunces", "serif"],
        body: ["Space Grotesk", "sans-serif"]
      },
      colors: {
        ink: "#0b1d1f",
        slate: "#1f2937",
        mist: "#e7ecef",
        wave: "#0f766e",
        amber: "#d97706",
        blush: "#f2d0a4"
      },
      boxShadow: {
        soft: "0 10px 30px rgba(15, 23, 42, 0.12)"
      }
    }
  },
  plugins: []
};
