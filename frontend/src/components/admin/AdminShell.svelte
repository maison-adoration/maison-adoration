<script>
  // Cadre commun des deux espaces d'administration :
  //   « Gestion de l'église » (/adm) et « Administration du système » (/systeme).
  // En-tête nuit, onglets (le premier est la vue par défaut), lien vers l'autre espace.
  import { createEventDispatcher } from "svelte";
  import get from "lodash.get";
  import config from "../../stores/config";

  export let space = "gestion"; // gestion | systeme
  export let title;
  export let intro = "";
  export let tabs = [];
  export let tab = "";

  const dispatch = createEventDispatcher();
  $: role = get($config, "currentUser.role");
  $: other =
    space === "gestion"
      ? role === "super-admin" && { href: "/systeme", label: "Administration du système" }
      : ["admin", "super-admin", "media"].includes(role) && { href: "/adm", label: "Gestion de l'église" };
</script>

<div class="on-light min-h-screen bg-[#F3F6FA]">
  <header class="bg-man-nuit text-white">
    <div class="max-w-[1240px] mx-auto px-5 md:px-10 pt-28 md:pt-32">
      <div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p class="text-man-doux font-bold text-[15px]">{space === "gestion" ? "Gestion de l'église" : "Administration du système"}</p>
          <h1 class="font-slab font-bold text-[32px] md:text-[40px] leading-tight">{title}</h1>
          {#if intro}<p class="mt-1 text-man-doux max-w-[620px]">{intro}</p>{/if}
        </div>
        {#if other}
          <a href={other.href} class="btn-ghost !min-h-[44px] text-[15px]">{other.label}</a>
        {/if}
      </div>
      <nav class="mt-5 -mx-5 px-5 flex gap-1 overflow-x-auto whitespace-nowrap" aria-label="Sections">
        {#each tabs as t}
          <button
            type="button"
            aria-current={tab == t.id ? "page" : undefined}
            class="relative shrink-0 inline-flex items-center gap-2 px-4 py-3 font-bold text-[15px] transition-colors duration-200 {tab == t.id ? 'text-white' : 'text-man-doux hover:text-white'}"
            on:click={() => dispatch("select", t.id)}
          >
            {t.label}
            {#if t.badge}<span class="min-w-[22px] h-[22px] px-1.5 rounded-full bg-man-or text-man-nuit text-[12px] font-extrabold inline-flex items-center justify-center" aria-label="{t.badge} en attente">{t.badge}</span>{/if}
            {#if tab == t.id}<span class="absolute left-4 right-4 bottom-0 h-[3px] rounded-t bg-man-or" aria-hidden="true"></span>{/if}
          </button>
        {/each}
      </nav>
    </div>
  </header>
  <div class="max-w-[1240px] mx-auto px-5 md:px-10 py-8 md:py-10">
    <slot />
  </div>
</div>
