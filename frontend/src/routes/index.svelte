<script>
  import SectionEvents from "./../components/index/SectionEvents.svelte";
  import Services from "./../components/index/Services.svelte";
  import Featured from "./../components/index/Featured.svelte";
  import SectionRessources from "./../components/index/SectionRessources.svelte";
  import SectionAbout from "./../components/index/SectionAbout.svelte";
  import Hero from "./../components/index/Hero.svelte";
  import { onMount } from "svelte";
  import * as animateScroll from "svelte-scrollto";
  import Contact from "../components/index/Contact.svelte";
  import get from "lodash.get";
  import config from "../stores/config";

  onMount(async () => {
    if (window.location.hash.toLowerCase().includes("#webinars")) {
      setTimeout(() => animateScroll.scrollTo({ element: "#webinars" }), 200);
    }
  });
</script>

<svelte:head>
  <title>Accueil - M.A.N. - Maison D'Adoration Pour les Nations</title>
</svelte:head>

<!-- ✅ -->
<Hero isLoggedIn={get($config, "currentUser.id") ? true : false} />

<!-- ✅ -->
<SectionAbout />

<!--  -->
<SectionEvents />
<!--  -->

<!--  -->
<Featured />

<!-- <Services /> -->

<!--  -->
<SectionRessources
  isLoggedIn={get($config, "currentUser.id") ? true : false}
/>

<!--  -->
<Contact />
