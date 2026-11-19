import { writable } from "svelte/store";

// État global du site, rempli au chargement par routes/__layout.svelte.
const config = writable({
  currentUser: null,
  stats: null,
  titles: [],
  settings: {
    currency: "USD",
    paymentsEnabled: false,
    vapidPublicKey: null,
  },
});

export default config;
