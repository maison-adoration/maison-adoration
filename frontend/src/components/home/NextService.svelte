<script>
  // Bandeau « Prochain rassemblement » : compte à rebours à l'heure de Lubumbashi.
  import { onMount } from "svelte";
  import { nextService, splitCountdown } from "../../utils/schedule";

  let next = nextService();
  let now = Date.now();
  onMount(() => {
    const id = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(id);
  });
  $: next = nextService(now);
  $: cd = splitCountdown(next.seconds);
</script>

<section aria-label="Prochain rassemblement" class="bg-man-nuit2 border-y border-man-trait px-5 md:px-10 py-10 md:py-14 text-white">
  <div class="max-w-[1240px] mx-auto rounded-[22px] overflow-hidden border border-man-bord/35 bg-man-nuit3/55 grid md:grid-cols-3">
    <div class="px-6 py-6 md:px-8 md:py-7 bg-man-marine/85 flex flex-col gap-1.5">
      {#if next.live}
        <span class="inline-flex items-center gap-2 text-sm font-extrabold text-man-lumiere"><span class="man-live w-2 h-2 rounded-full bg-man-lumiere"></span>En cours maintenant</span>
      {:else}
        <span class="text-sm font-bold text-[#B9D3EA]">Prochain rassemblement</span>
      {/if}
      <span class="font-slab text-[26px] md:text-[28px] font-bold">{next.service.name}</span>
      <span class="text-[15px] text-man-doux">{next.service.label}</span>
    </div>
    <div class="px-6 py-5 md:px-7 flex items-center gap-3 md:gap-4" role="timer" aria-label={next.live ? "Le rassemblement est en cours" : cd.label}>
      {#if next.live}
        <a href="/live" class="btn-or">Suivre en direct</a>
      {:else}
        {#each cd.parts as p}
          <div aria-hidden="true" class="flex flex-col items-center min-w-[54px]">
            <span class="font-slab text-[34px] md:text-[40px] font-bold tabular-nums">{p.v}</span>
            <span class="text-[13px] text-[#B9C9DD]">{p.l}</span>
          </div>
        {/each}
      {/if}
    </div>
    <div class="px-6 py-5 md:px-7 flex flex-col justify-center gap-1 border-t md:border-t-0 md:border-l border-man-bord/30">
      <span class="text-sm font-bold text-man-or">Adresse</span>
      <span class="text-[15px] leading-snug text-man-texte">2094, av. Kapenda, coin Kimbangu, à côté de l'hôpital chinois Ruichen</span>
      <a href="https://www.google.com/maps/search/?api=1&query=Avenue+Kapenda+2094+Lubumbashi" target="_blank" rel="noopener" class="mt-1 text-[15px] font-bold text-man-ciel hover:text-white min-h-[32px] inline-flex items-center">Itinéraire</a>
    </div>
  </div>
</section>
