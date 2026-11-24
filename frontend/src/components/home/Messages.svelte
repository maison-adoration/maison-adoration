<script>
  import { reveal } from "../../utils/motion";
  // Derniers messages (sermons publiés dans la médiathèque), en diaporama contrôlable.
  import { onMount } from "svelte";
  import api from "../../utils/api";
  import { cdn } from "../../utils/cdn";
  import { thumbnailFor } from "../media/embed";
  import { createAutoplay, swipe } from "../../utils/autoplay";
  import AutoplayControls from "../shared/AutoplayControls.svelte";

  let sermons = null; // null = chargement
  const ap = createAutoplay({ count: 1, dur: 6 });
  let dragDX = 0;
  let viewport;
  let cardW = 600;

  onMount(async () => {
    try {
      const data = (await api.get("/media/public/overview")).data;
      sermons = (data.sermons || []).slice(0, 6);
    } catch (e) {
      sermons = [];
    }
    ap.setCount(Math.max(1, (sermons || []).length));
    const measure = () => (cardW = viewport && viewport.clientWidth < 700 ? Math.min(320, viewport.clientWidth - 48) : 600);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  });

  const image = (s) => cdn(s.thumbnail_url || thumbnailFor(s.video_url) || "/images/design/predication.jpg", 700);
  const meta = (s) =>
    [s.preacher, s.sermon_date && new Date(s.sermon_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })]
      .filter(Boolean)
      .join(", ");

  $: gap = cardW < 600 ? 14 : 24;
  $: n = sermons ? sermons.length : 0;
  $: resist = ($ap.index === 0 && dragDX > 0) || ($ap.index === n - 1 && dragDX < 0) ? 0.35 : 1;
  $: shift = -$ap.index * (cardW + gap) + dragDX * resist;

  function cardClick(e, i) {
    if (i !== $ap.index) {
      e.preventDefault();
      ap.pick(i);
    }
  }
</script>

<section class="bg-man-nuit text-white py-20 md:py-28" aria-labelledby="titre-messages">
  <div class="max-w-[1320px] mx-auto px-5 md:px-10 flex flex-wrap justify-between items-end gap-5 mb-8">
    <h2 use:reveal id="titre-messages" class="font-slab font-bold text-[38px] md:text-[clamp(42px,5vw,72px)] leading-none">La Parole, où que vous soyez.</h2>
    <a href="/mediatheque" class="btn-ghost">Toute la médiathèque</a>
  </div>

  {#if sermons === null}
    <div class="max-w-[1320px] mx-auto px-5 md:px-10 flex gap-6" aria-hidden="true">
      <div class="h-[380px] md:h-[440px] w-full md:w-[600px] rounded-[26px] bg-man-nuit3 animate-pulse"></div>
    </div>
  {:else if sermons.length === 0}
    <div class="max-w-[1320px] mx-auto px-5 md:px-10">
      <a href="https://www.youtube.com/@mantv6688" target="_blank" rel="noopener" class="press relative block h-[320px] md:h-[440px] rounded-[26px] overflow-hidden">
        <img src="/images/design/predication.jpg" alt="" loading="lazy" class="absolute inset-0 w-full h-full object-cover" />
        <span aria-hidden="true" class="absolute inset-0" style="background: linear-gradient(0deg, rgba(10,27,51,.95) 0%, rgba(10,27,51,0) 60%)"></span>
        <span class="absolute left-7 right-7 bottom-7 flex flex-col gap-1.5">
          <span class="text-sm font-bold text-man-or">MAN TV</span>
          <span class="font-slab font-bold text-[28px] md:text-[38px] leading-tight">Les cultes et enseignements sur notre chaîne YouTube</span>
        </span>
      </a>
    </div>
  {:else}
    <div
      role="region"
      aria-roledescription="carrousel"
      aria-label="Derniers messages"
      use:ap.observe
      on:mouseenter={ap.enter}
      on:mouseleave={ap.leave}
      on:focusin={ap.focusIn}
      on:focusout={ap.focusOut}
    >
      <div
        bind:this={viewport}
        class="overflow-hidden touch-pan-y"
        style="padding-left: max(20px, calc((100% - 1240px) / 2))"
        use:swipe={{
          onStart: ap.touch,
          onMove: (dx) => (dragDX = dx),
          onEnd: (d) => d && (d > 0 ? ap.pick(Math.min(n - 1, $ap.index + 1)) : ap.pick(Math.max(0, $ap.index - 1))),
        }}
      >
        <div
          class="flex"
          style="gap: {gap}px; transform: translateX({shift}px); transition: {dragDX ? 'none' : 'transform 760ms cubic-bezier(.77,0,.175,1)'}"
          aria-live={$ap.live}
        >
          {#each sermons as s, i}
            <a
              href="/mediatheque?message={encodeURIComponent(s.id)}"
              on:click={(e) => cardClick(e, i)}
              draggable="false"
              aria-label="{s.title}{i === $ap.index ? '' : ', afficher'}"
              class="rowcard relative flex-none h-[380px] md:h-[440px] rounded-[26px] overflow-hidden"
              style="width: {cardW}px; opacity: {i === $ap.index ? 1 : 0.45}; transform: {i === $ap.index ? 'none' : 'scale(.94)'}; transition: opacity 500ms ease, transform 600ms cubic-bezier(.23,1,.32,1)"
            >
              <img src={image(s)} alt="" loading="lazy" draggable="false" class="rc-img absolute inset-0 w-full h-full object-cover pointer-events-none" />
              <span aria-hidden="true" class="absolute inset-0" style="background: linear-gradient(0deg, rgba(10,27,51,.95) 0%, rgba(10,27,51,0) 60%)"></span>
              <span class="absolute left-6 md:left-8 right-24 bottom-6 md:bottom-7 flex flex-col gap-1.5">
                {#if meta(s)}<span class="text-sm font-bold text-man-or">{meta(s)}</span>{/if}
                <span class="font-slab font-bold text-[24px] md:text-[34px] leading-tight line-clamp-3">{s.title}</span>
              </span>
              <span aria-hidden="true" class="absolute right-6 bottom-6 w-14 h-14 rounded-full flex items-center justify-center transition-colors duration-300" style="background: {i === $ap.index ? '#E4BE05' : 'rgba(255,255,255,.18)'}">
                <svg width="22" height="22" viewBox="0 0 24 24" fill={i === $ap.index ? "#0A1B33" : "#FFFFFF"}><path d="M8 5v14l11-7z" /></svg>
              </span>
            </a>
          {/each}
        </div>
      </div>
      {#if n > 1}
        <div class="max-w-[1320px] mx-auto px-5 md:px-10 mt-6 flex items-center gap-2 flex-wrap">
          <AutoplayControls {ap} what="Message">
            <button type="button" class="press hidden md:flex w-12 h-12 rounded-full border-[1.5px] border-man-bord items-center justify-center hover:border-man-ciel" aria-label="Message précédent" on:click={ap.prev}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <button type="button" class="press hidden md:flex w-12 h-12 rounded-full border-[1.5px] border-man-bord items-center justify-center hover:border-man-ciel" aria-label="Message suivant" on:click={ap.next}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </AutoplayControls>
        </div>
      {/if}
    </div>
  {/if}
</section>

<style>
  @media (hover: hover) and (pointer: fine) {
    .rowcard:hover .rc-img { transform: scale(1.04); }
  }
  .rc-img { transition: transform 320ms cubic-bezier(.23,1,.32,1); }
  @media (prefers-reduced-motion: reduce) { .rc-img { transition: none; } }
</style>
