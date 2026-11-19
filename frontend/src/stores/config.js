import { writable } from "svelte/store";

// État global du site, rempli au chargement par routes/__layout.svelte.
const config = writable({
  currentUser: null,
  userLoaded: false, // true une fois la vérification de connexion terminée
  stats: null,
  titles: [],
  settings: {
    currency: "USD",
    paymentsEnabled: false,
    vapidPublicKey: null,
  },
});

export default config;
