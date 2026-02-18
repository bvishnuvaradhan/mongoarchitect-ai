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
        ink: "#E3FCF7",      // Light text on dark bg
        slate: "#A0AEC0",    // Muted gray text
        mist: "#003B4A",     // Dark card background
        wave: "#13AA52",     // MongoDB leaf green
        amber: "#00ED64",    // Bright green accent
        blush: "#001E2B"     // Darkest navy
      },
      boxShadow: {
        soft: "0 10px 30px rgba(15, 23, 42, 0.12)"
      }
    }
  },
  plugins: []
};
