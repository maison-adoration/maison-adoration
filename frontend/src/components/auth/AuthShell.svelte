<script>
  // Écrans de compte (connexion, inscription, mot de passe) : photo fondue à gauche
  // sur ordinateur, bandeau court sur téléphone, formulaire sur fond nuit.
  export let title;
  export let intro = "";
  export let image = "/images/design/assemblee-large.jpg";
  export let imageMobile = "/images/design/assemblee-large-800.jpg";
</script>

<div class="min-h-[100svh] bg-man-nuit text-white md:grid md:grid-cols-[1.05fr_1fr]">
  <div class="relative overflow-hidden h-[190px] md:h-auto" aria-hidden="true">
    <picture>
      <source media="(max-width: 767px)" srcset={imageMobile} />
      <img src={image} alt="" class="man-settle absolute inset-0 w-full h-full object-cover opacity-50" />
    </picture>
    <span class="absolute inset-0 hidden md:block" style="background: linear-gradient(90deg, rgba(10,27,51,.2) 0%, rgba(10,27,51,.55) 60%, #0A1B33 100%)"></span>
    <span class="absolute inset-0 md:hidden" style="background: linear-gradient(180deg, rgba(10,27,51,.55) 0%, #0A1B33 100%)"></span>
    <div class="hidden md:block absolute left-12 bottom-14 max-w-[420px]">
      <p class="font-slab font-bold text-[34px] leading-tight">Ramener les Nations à genoux à la croix.</p>
      <p class="mt-3 text-man-doux">Maison d'Adoration pour les Nations, Lubumbashi</p>
    </div>
  </div>

  <div class="relative flex items-start md:items-center justify-center px-5 pb-16 md:pt-28 md:pb-16 -mt-14 md:mt-0">
    <div class="w-full max-w-[440px]">
      <h1 class="man-r1 font-slab font-bold text-[36px] md:text-[44px] leading-[1.05]" style="animation-delay:40ms">{title}</h1>
      {#if intro}<p class="man-r2 mt-3 text-[17px] leading-relaxed text-man-doux" style="animation-delay:100ms">{intro}</p>{/if}
      <div class="man-r3 mt-8" style="animation-delay:160ms"><slot /></div>
    </div>
  </div>
</div>
