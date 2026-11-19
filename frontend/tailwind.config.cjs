// rgb(218,28,92)
// #133b6e
// hsl(340, 77%, 48%)
// rgb(16, 185, 129)

module.exports = {
  content: ['./src/**/*.svelte'],
  theme: {
    extend: {
      colors: {
        "brand-white": "#f5f5f5",
        "brand-blue-second": "#133b6e",
        "brand-blue-primary": "#3695cb",
        // ....................
        "brand-second": "#C68101",
        "brand-primary": "#C68101",
        // ....................
        "brand-coffee": "#cb6c36",
        "brand-black": "#fcfcfc",
        "brand-black-light": "#f0f0f0",
      },
      // spacing: {
      //   '128': '32rem',
      // },
      // maxWidth: {
      //   '7xl': '80rem',
      // },
      // fontSize: {
      //   '7xl': '5rem',
      // },
    },
  },
  // variants: {
  //   extend: {},
  // },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/line-clamp')],
}