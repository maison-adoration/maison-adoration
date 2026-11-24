<script>
  // En-tête des pages de contenu (Maison, Ministères, Extensions…), charte M.A.N.
  export let title;
  export let subtitle = "";
  export let image = "/images/design/assemblee-large.jpg"; // photo fondue derrière le texte
  export let imageMobile = null;
</script>

<header class="relative overflow-hidden bg-man-nuit text-white">
  {#if image}
    <picture>
      {#if imageMobile}<source media="(max-width: 767px)" srcset={imageMobile} />{/if}
      <img src={image} alt="" class="absolute inset-0 w-full h-full object-cover opacity-35" />
    </picture>
    <span aria-hidden="true" class="absolute inset-0" style="background: linear-gradient(90deg, #0A1B33 20%, rgba(10,27,51,.6) 70%, rgba(10,27,51,.35) 100%), linear-gradient(0deg, #0A1B33 0%, rgba(10,27,51,0) 45%)"></span>
  {/if}
  <div class="relative max-w-[1240px] mx-auto px-5 md:px-10 pt-36 pb-16 md:pt-44 md:pb-24">
    <h1 style="animation-delay:60ms" class="man-r1 font-slab font-bold text-[44px] md:text-[clamp(56px,7vw,96px)] leading-[.95] max-w-[900px]">{title}</h1>
    {#if subtitle}
      <p style="animation-delay:130ms" class="man-r2 mt-5 text-lg md:text-xl leading-relaxed text-man-doux max-w-[620px]">{subtitle}</p>
    {/if}
    <div class="man-r3" style="animation-delay:200ms"><slot /></div>
  </div>
</header>
