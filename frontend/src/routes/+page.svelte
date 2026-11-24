<script>
  import { onMount, tick } from "svelte";
  import get from "lodash.get";
  import config from "../stores/config";
  import { nextService } from "../utils/schedule";
  import Hero from "../components/home/Hero.svelte";
  import NextService from "../components/home/NextService.svelte";
  import Maison from "../components/home/Maison.svelte";
  import Programme from "../components/home/Programme.svelte";
  import Messages from "../components/home/Messages.svelte";
  import Ministries from "../components/home/Ministries.svelte";
  import Visit from "../components/home/Visit.svelte";
  import Give from "../components/home/Give.svelte";
  import SectionRessources from "../components/index/SectionRessources.svelte";

  let live = false;
  let visitDay = "dim";

  async function plan(e) {
    visitDay = e.detail;
    await tick();
    const el = document.getElementById("visite");
    if (el) el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  onMount(() => {
    live = nextService().live;
    // Anciens liens « /#webinars » : les contenus sont désormais dans « Ressources ».
    if (window.location.hash.toLowerCase().includes("#webinars")) {
      setTimeout(() => {
        const el = document.getElementById("ressources");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }, 200);
    }
  });
</script>

<svelte:head>
  <title>Accueil - M.A.N. - Maison D'Adoration Pour les Nations</title>
  <meta name="description" content="Église charismatique à Lubumbashi. Cultes le mercredi, le vendredi et le dimanche, messages en ligne et dons par Mobile Money." />
</svelte:head>

<Hero {live} />
<NextService />
<Maison />
<Programme on:plan={plan} />
<Messages />
<div class="bg-white on-light">
  <SectionRessources isLoggedIn={get($config, "currentUser.id") ? true : false} />
</div>
<Ministries />
<Visit day={visitDay} />
<Give />
