<script>
  /* STYLES IMPORTS */
  import "../styles/app.css";
  import "../styles/tailwind-output.css";
  /* JS IMPORTS */
  import NavBar from "../components/layout/NavBar.svelte";
  import Footer from "../components/layout/Footer.svelte";
  import config from "../stores/config";
  import { onMount } from "svelte";
  import api, { getToken } from "../utils/api";

  // Le site s'affiche tout de suite ; les données de l'API arrivent ensuite.
  // (Avant, toute la page attendait l'API — très lent quand le serveur se réveille.)
  onMount(() => {
    if ($config.currentUser) return;

    api.get("/settings")
      .then((r) => config.update((p) => ({ ...p, settings: r.data })))
      .catch(() => {});
    api.get("/stats")
      .then((r) => config.update((p) => ({ ...p, stats: r.data })))
      .catch(() => {});
    api.get("/contents/titles")
      .then((r) => config.update((p) => ({ ...p, titles: r.data })))
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
<div class="scroll-smooth" />

<style>
  .layout {
    width: 100%;
  }
</style>
