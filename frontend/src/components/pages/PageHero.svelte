<script>
  // En-tête sombre des pages de contenu (Maison, Ministères, Extensions).
  import Container from "../utils/Container.svelte";

  export let title;
  export let subtitle = "";
  export let image = null; // photo à droite (facultative)
</script>

<div class="relative bg-[#111111] hero-pattern pt-24 pb-24 md:pb-32">
  <Container>
    <div class="flex flex-col md:flex-row md:items-center gap-8 text-gray-300">
      <div class="w-full" class:md:w-3-5={image}>
        <h1 class="drop-shadow-sm h-font text-5xl leading-[3.4rem] md:text-7xl md:leading-[4.6rem] uppercase">
          {title}
        </h1>
        {#if subtitle}
          <p class="mt-4 text-sm md:text-base text-gray-400 max-w-2xl">{subtitle}</p>
        {/if}
        <slot />
      </div>
      {#if image}
        <div class="w-full md:w-2/5">
          <div
            class="h-[40vh] md:h-[60vh] w-full rounded-xl shadow-lg"
            style="background-image: url('{image}'); background-size: cover; background-position: top;"></div>
        </div>
      {/if}
    </div>
  </Container>

  <div class="hidden md:block absolute bottom-0 left-0 right-0 w-full">
    <img src="/images/wave-haikei-white.svg" class="w-full" alt="" />
  </div>
  <div class="md:hidden absolute bottom-0 left-0 right-0 w-full">
    <img src="/images/wave-haikei-white-mobile.svg" class="w-full" alt="" />
  </div>
</div>

<style>
  .hero-pattern {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cg fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.015' fill-rule='nonzero'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  }
  @media (min-width: 768px) {
    .md\:w-3-5 {
      width: 60%;
    }
  }
</style>
