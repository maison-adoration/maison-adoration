<script>
  // Accueil : le texte domine, les arcs du logo se dessinent et la lumière s'allume
  // derrière la croix (seule animation qui se joue sans action du visiteur).
  export let live = false;
</script>

<section class="relative min-h-[100svh] md:min-h-[940px] overflow-hidden flex items-center bg-man-nuit text-white">
  <picture>
    <source media="(max-width: 767px)" srcset="/images/design/sanctuaire-800.jpg" />
    <img
      src="/images/design/sanctuaire.jpg"
      alt=""
      aria-hidden="true"
      fetchpriority="high"
      class="man-settle absolute inset-0 w-full h-full object-cover opacity-[.42]"
      style="object-position: 30% 40%"
    />
  </picture>
  <div aria-hidden="true" class="absolute inset-0" style="background: linear-gradient(180deg, rgba(10,27,51,.6) 0%, rgba(10,27,51,.35) 40%, rgba(10,27,51,.75) 75%, #0A1B33 100%)"></div>

  <div aria-hidden="true" class="absolute right-[-170px] top-24 w-[360px] h-[360px] md:right-[4%] md:top-1/2 md:w-[640px] md:h-[640px] md:-mt-[340px]">
    <div class="man-halo absolute inset-[22%] rounded-full" style="background: radial-gradient(circle, rgba(249,230,2,.38) 0%, rgba(228,190,5,.14) 42%, rgba(228,190,5,0) 70%)"></div>
    <div class="man-arc-1 absolute inset-0 rounded-full border-[3px] border-transparent" style="border-top-color: #29507E; border-left-color: #29507E"></div>
    <div class="man-arc-2 absolute inset-[9%] rounded-full border-[2.5px] border-transparent" style="border-top-color: #4AB0EB; border-left-color: rgba(74,176,235,.45)"></div>
    <div class="man-arc-3 absolute inset-[18%] rounded-full border-2 border-transparent" style="border-top-color: #E4BE05"></div>
    <img src="/images/man-white.png" alt="" class="hidden md:block absolute left-1/2 top-1/2 w-[230px] -ml-[115px] -mt-[128px] opacity-[.16]" />
  </div>

  <div class="relative w-full max-w-[1320px] mx-auto px-5 md:px-10 pt-28 pb-24 md:pt-44 md:pb-32">
    <p class="man-r1 mb-4 md:mb-5 text-sm md:text-base font-bold text-man-or">Église charismatique à Lubumbashi, depuis 2019</p>
    <h1 class="man-r2 max-w-[780px] font-slab font-bold text-[44px] leading-[.98] md:text-[clamp(46px,6.6vw,92px)] tracking-[-.01em]">
      Ramener les Nations à genoux à la croix.
    </h1>
    <p class="man-r3 mt-6 md:mt-7 max-w-[540px] text-[17px] md:text-[19px] leading-relaxed text-man-doux">
      Par l'enseignement de la Parole et la puissance du Saint-Esprit. Rejoignez-nous en personne ou en ligne, chaque dimanche à 8h30.
    </p>
    <div class="man-r4 mt-8 md:mt-10 flex gap-3 flex-wrap">
      <a href="#visite" class="btn-or !min-h-[56px] !px-8 text-base">Planifier ma visite</a>
      <a href={live ? "/live" : "/mediatheque"} class="btn-ghost !min-h-[56px] text-base">
        {#if live}<span class="man-live w-2.5 h-2.5 rounded-full bg-man-lumiere"></span>Suivre le culte en direct{:else}Regarder les messages{/if}
      </a>
    </div>
  </div>
</section>
