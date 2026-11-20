<script>
  /* STYLES IMPORTS */
  // Polices auto-hébergées (sous-ensemble latin) : plus de requête bloquante vers Google Fonts
  import "@fontsource-variable/manrope/index.css";
  import "@fontsource/bebas-neue/latin-400.css";
  import "@fontsource/oswald/latin-300.css";
  import "@fontsource/oswald/latin-400.css";
  import "@fontsource/oswald/latin-500.css";
  import "../styles/app.css";
  import "../styles/tailwind.css";
  import { setupIcons } from "../utils/icons.js";
  /* JS IMPORTS */
  import NavBar from "../components/layout/NavBar.svelte";
  import Footer from "../components/layout/Footer.svelte";
  import config from "../stores/config";
  import { onMount } from "svelte";
  import api, { getToken } from "../utils/api";

  setupIcons();

  // Le site s'affiche tout de suite ; les données de l'API arrivent ensuite.
  // (Avant, toute la page attendait l'API — très lent quand le serveur se réveille.)
  onMount(() => {
    if ($config.currentUser) return;

    api.get("/settings")
      .then((r) => config.update((p) => ({ ...p, settings: r.data })))
      .catch(() => {});
    if (getToken()) {
      api.get("/auth/me")
        .then((r) => config.update((p) => ({ ...p, currentUser: r.data, userLoaded: true })))
        .catch(() => config.update((p) => ({ ...p, userLoaded: true })));
    } else {
      config.update((p) => ({ ...p, userLoaded: true }));
    }
  });
</script>

<div
  class={`text-base bg-brand-black text-gray-700 tracking-wide w-full layout`}
  id="home"
>
  <NavBar />
  <slot />
  <Footer />
</div>

<!-- For tailwind purge -->
<div class="scroll-smooth"></div>

<style>
  .layout {
    width: 100%;
  }
</style>
