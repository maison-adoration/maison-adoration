<script>
  import { reveal } from "../../utils/motion";
  // Ministères : galerie dont la vignette ouverte avance seule ; survol, clic ou
  // glissement donnent la main au visiteur. Sur téléphone : rangée qu'on glisse au doigt.
  import { createAutoplay, swipe } from "../../utils/autoplay";
  import AutoplayControls from "../shared/AutoplayControls.svelte";

  // Ministères publiés sur la page /ministeres (mêmes ancres).
  const MINIS = [
    { slug: "man-kids", name: "Man Kids", text: "Les enfants découvrent la Bible et grandissent dans leur foi, en s'amusant.", img: "/images/design/assemblee-large.jpg" },
    { slug: "man-bible-college", name: "Man Bible College", text: "Théologie, étude de la Bible et leadership pour former des serviteurs solides.", img: "/images/design/enseignement.jpg" },
    { slug: "hospitalite", name: "Hospitalité", text: "L'équipe qui accueille chaque visiteur comme un membre de la famille.", img: "/images/design/fideles.jpg" },
    { slug: "man-worship", name: "Man Worship", text: "La louange qui conduit l'assemblée dans l'adoration.", img: "/images/design/adoration.jpg" },
    { slug: "psaumes-41", name: "Psaumes 41", text: "Donner, visiter et servir ceux qui sont dans le besoin.", img: "/images/design/assemblee.jpg" },
    { slug: "morning-prayer", name: "Morning Prayer", text: "Commencer chaque journée dans la prière, ensemble.", img: "/images/design/predication.jpg" },
  ];
  const ap = createAutoplay({ count: MINIS.length, dur: 5 });
  let dragDX = 0;
  const STEP = 222; // largeur d'une carte téléphone + espace
  $: maxI = MINIS.length - 2;
  $: mobileI = Math.min($ap.index, maxI);

  function tileClick(e, i) {
    // première touche : ouvre la vignette ; deuxième : va au ministère
    if (i !== $ap.index) { e.preventDefault(); ap.pick(i); }
  }
</script>

<section
  id="ministeres"
  class="relative overflow-hidden bg-man-nuit2 text-white px-5 md:px-10 py-20 md:py-28"
  aria-roledescription="carrousel"
  aria-label="Ministères"
  use:ap.observe
  on:mouseenter={ap.enter}
  on:mouseleave={ap.leave}
  on:focusin={ap.focusIn}
  on:focusout={ap.focusOut}
>
  <div aria-hidden="true" class="absolute inset-0 hidden md:block">
    {#each MINIS as m, i}
      <img src={m.img} alt="" loading="lazy" class="man-xfade absolute inset-0 w-full h-full object-cover" style="filter: blur(36px) saturate(1.2); transform: scale(1.15); opacity: {i === $ap.index ? 0.5 : 0}" />
    {/each}
  </div>
  <div class="relative max-w-[1240px] mx-auto">
    <div class="flex justify-between items-end gap-5 mb-8">
      <h2 use:reveal class="font-slab font-bold text-[38px] md:text-[clamp(42px,5vw,72px)] leading-none">Grandir, servir, être formé.</h2>
      <AutoplayControls {ap} dots={false} />
    </div>

    <!-- Ordinateur : vignettes qui s'ouvrent -->
    <div class="hidden md:flex gap-3 h-[520px]" aria-live={$ap.live}>
      {#each MINIS as m, i}
        <a
          href="/ministeres#{m.slug}"
          class="tile relative min-w-0 rounded-3xl overflow-hidden"
          class:open={i === $ap.index}
          aria-current={i === $ap.index ? "true" : undefined}
          on:mouseenter={() => i !== $ap.index && ap.pick(i)}
          on:focus={() => i !== $ap.index && ap.pick(i)}
          on:click={(e) => tileClick(e, i)}
        >
          <img src={m.img} alt="" loading="lazy" class="tile-img absolute inset-0 w-full h-full object-cover" />
          <span aria-hidden="true" class="absolute inset-0" style="background: linear-gradient(0deg, rgba(10,27,51,.95) 0%, rgba(10,27,51,.15) 60%)"></span>
          <span class="absolute left-5 right-4 bottom-6 flex flex-col gap-2.5">
            <span class="font-slab font-bold leading-tight {i === $ap.index ? 'text-[30px]' : 'text-[19px]'}">{m.name}</span>
            <span class="tile-txt text-base leading-relaxed text-man-texte max-w-[360px]">{m.text}</span>
          </span>
          {#if i === $ap.index}
            <span aria-hidden="true" class="absolute left-0 bottom-0 h-1 bg-man-or" style="width: {$ap.progress * 100}%; transition: {$ap.t === 0 || !$ap.running ? 'none' : 'width 1000ms linear'}"></span>
          {/if}
        </a>
      {/each}
    </div>

    <!-- Téléphone : rangée à glisser -->
    <div
      class="md:hidden -mx-5 overflow-hidden touch-pan-y"
      use:swipe={{
        onStart: ap.touch,
        onMove: (dx) => (dragDX = dx),
        onEnd: (d) => d && ap.pick(Math.max(0, Math.min(maxI, mobileI + d))),
      }}
    >
      <div
        class="flex gap-3 px-5"
        style="transform: translateX({-mobileI * STEP + dragDX * ((mobileI === 0 && dragDX > 0) || (mobileI === maxI && dragDX < 0) ? 0.35 : 1)}px); transition: {dragDX ? 'none' : 'transform 480ms cubic-bezier(.32,.72,0,1)'}"
      >
        {#each MINIS as m, i}
          <a href="/ministeres#{m.slug}" draggable="false" class="press relative flex-none w-[210px] h-[250px] rounded-[22px] overflow-hidden transition-opacity duration-300" style="opacity: {i >= mobileI && i <= mobileI + 1 ? 1 : 0.55}">
            <img src={m.img} alt="" loading="lazy" draggable="false" class="absolute inset-0 w-full h-full object-cover pointer-events-none" />
            <span aria-hidden="true" class="absolute inset-0" style="background: linear-gradient(180deg, rgba(10,27,51,0) 30%, rgba(10,27,51,.9) 100%)"></span>
            <span class="absolute left-4 right-4 bottom-4 font-slab font-bold text-[21px] leading-tight">{m.name}</span>
          </a>
        {/each}
      </div>
    </div>
  </div>
</section>

<style>
  .tile { flex: 1 1 0; transition: flex-grow 520ms cubic-bezier(.77,0,.175,1); }
  .tile.open { flex-grow: 3.2; }
  .tile .tile-txt { opacity: 0; transform: translateY(10px); transition: opacity 260ms ease, transform 320ms cubic-bezier(.23,1,.32,1); }
  .tile.open .tile-txt { opacity: 1; transform: none; transition-delay: 180ms; }
  .tile-img { transition: transform 700ms cubic-bezier(.23,1,.32,1); }
  @media (hover: hover) and (pointer: fine) { .tile:hover .tile-img { transform: scale(1.04); } }
  @media (prefers-reduced-motion: reduce) {
    .tile, .tile .tile-txt, .tile-img { transition: none; }
  }
</style>
