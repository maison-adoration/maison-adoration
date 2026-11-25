<script>
  // En-tête de l'espace membre : salutation et onglets « Mes contenus » / « Mon profil ».
  import { page } from "$app/stores";
  import config from "../../stores/config";

  $: first = (($config.currentUser && $config.currentUser.name) || "").trim().split(/\s+/)[0];
  const TABS = [
    { href: "/mes-contenus", label: "Mes contenus" },
    { href: "/profile", label: "Mon profil" },
  ];
</script>

<header class="relative overflow-hidden bg-man-nuit text-white">
  <div aria-hidden="true" class="absolute -right-32 -top-32 w-[420px] h-[420px] rounded-full" style="background: radial-gradient(circle, rgba(228,190,5,.14) 0%, rgba(228,190,5,0) 65%)"></div>
  <div class="relative max-w-[1040px] mx-auto px-5 md:px-10 pt-32 md:pt-36">
    <p class="man-r1 text-man-doux" style="animation-delay:40ms">Mon espace</p>
    <h1 class="man-r2 mt-1 font-slab font-bold text-[36px] md:text-[48px] leading-tight" style="animation-delay:100ms">
      {first ? `Bonjour, ${first}` : "Bonjour"}
    </h1>
    <nav class="mt-7 flex gap-1" aria-label="Mon espace">
      {#each TABS as t}
        {@const on = $page.url.pathname === t.href}
        <a
          href={t.href}
          aria-current={on ? "page" : undefined}
          class="relative px-4 py-3 font-bold transition-colors duration-200 {on ? 'text-white' : 'text-man-doux hover:text-white'}"
        >
          {t.label}
          {#if on}<span class="absolute left-4 right-4 bottom-0 h-[3px] rounded-t bg-man-or" style="view-transition-name: man-member-tab" aria-hidden="true"></span>{/if}
        </a>
      {/each}
    </nav>
  </div>
</header>
