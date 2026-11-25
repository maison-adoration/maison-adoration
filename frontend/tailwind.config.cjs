// rgb(218,28,92)
// #133b6e
// hsl(340, 77%, 48%)
// rgb(16, 185, 129)

module.exports = {
  content: ['./src/**/*.{svelte,js,html}'],
  theme: {
    extend: {
      colors: {
        "brand-white": "#f5f5f5",
        "brand-blue-second": "#133b6e",
        "brand-blue-primary": "#3695cb",
        // ....................
        "brand-second": "#7A5600", // ancien doré #C68101, assombri pour le contraste AA
        "brand-primary": "#7A5600", // ancien doré #C68101, assombri pour le contraste AA
        // ....................
        "brand-coffee": "#cb6c36",
        "brand-black": "#fcfcfc",
        "brand-black-light": "#f0f0f0",
        // Charte « La lumière derrière la croix » (couleurs tirées du logo)
        man: {
          nuit: "#0A1B33",      // fonds forts
          nuit2: "#0E2240",     // bandeaux, feuilles
          nuit3: "#12294A",     // champs, sélecteurs
          trait: "#1E3A63",     // filets sur fond nuit
          marine: "#173E6F",    // marine de la croix
          horizon: "#29507E",   // arcs extérieurs, pistes
          bord: "#7F9CC0",      // contours de boutons secondaires
          ciel: "#4AB0EB",      // ciel des arcs, focus sur fond sombre
          or: "#E4BE05",        // action principale
          orvif: "#F0CB12",     // survol du bouton or
          lumiere: "#F9E602",   // halo, point « en direct »
          ortexte: "#8A6100",   // or lisible sur fond clair
          texte: "#DCE6F2",     // texte clair secondaire
          doux: "#C9D6E8",      // texte clair tertiaire
          brume: "#E8F1F9",
          porcelaine: "#F6F8FB",
        },
      },
      fontFamily: {
        slab: ['"Zilla Slab"', "Georgia", "serif"],
      },
      transitionTimingFunction: {
        out: "cubic-bezier(.23,1,.32,1)",
        drawer: "cubic-bezier(.32,.72,0,1)",
        inout: "cubic-bezier(.77,0,.175,1)",
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
  plugins: [require('@tailwindcss/forms')], // line-clamp est inclus dans Tailwind 3.3+
}