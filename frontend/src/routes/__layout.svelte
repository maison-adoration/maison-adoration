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
  import Loading from "../components/utils/Loading.svelte";

  let loading = true;

  onMount(async () => {
    if ($config.currentUser) {
      loading = false;
      return;
    }
    // Chaque appel est indépendant : si l'un échoue, le site s'affiche quand même.
    const [settings, me, stats, titles] = await Promise.allSettled([
      api.get("/settings"),
      getToken() ? api.get("/auth/me") : Promise.reject(),
      api.get("/stats"),
      api.get("/contents/titles"),
    ]);

    config.update((prev) => ({
      ...prev,
      settings: settings.status === "fulfilled" ? settings.value.data : prev.settings,
      currentUser: me.status === "fulfilled" ? me.value.data : null,
      stats: stats.status === "fulfilled" ? stats.value.data : null,
      titles: titles.status === "fulfilled" ? titles.value.data : [],
    }));

    loading = false;
  });
</script>

<div
  class={`text-base bg-brand-black text-gray-700 tracking-wide w-full layout`}
  id="home"
>
  {#if loading}
    <div class="h-screen flex items-center justify-center">
      <Loading text="Veuillez patienter" />
    </div>
  {:else}
    <NavBar />
    <slot />
    <Footer />
  {/if}
</div>

<!-- For tailwind purge -->
<div class="scroll-smooth" />

<style>
  .layout {
    width: 100%;
  }
</style>
