<script>
  import { reveal } from "../../utils/motion";
  import { cdn } from "../../utils/cdn.js";
  // Affiche les sections publiées d'une page (modifiables dans l'espace admin).
  import { onMount, tick } from "svelte";
  import api from "../../utils/api";
  import Container from "../utils/Container.svelte";
  import Loading from "../utils/Loading.svelte";

  export let page;
  export let emptyText = "Contenu bientôt disponible.";
  export let showNav = false; // sommaire cliquable en haut

  let sections = null;

  onMount(async () => {
    try {
      const res = await api.get("/sections", { params: { page } });
      // Même un admin connecté ne voit ici que ce qui est publié
      sections = res.data.filter((s) => s.published);
    } catch (err) {
      sections = [];
    }
    // Lien vers une section (/maison#presentation-pasteurs) : la section n'existait
    // pas encore quand le navigateur a cherché l'ancre, on y va une fois affichée.
    await tick();
    const id = decodeURIComponent(location.hash.slice(1));
    const el = id && document.getElementById(id);
    if (el) el.scrollIntoView();
  });
</script>

<div class="bg-white on-light py-14 md:py-20">
  <Container>
    {#if sections == null}
      <Loading text="Veuillez patienter" />
    {:else if sections.length == 0}
      <p class="text-[#3D5578] py-16">{emptyText}</p>
    {:else}
      {#if showNav && sections.length > 1}
        <nav class="flex flex-wrap gap-2 mb-12" aria-label="Sur cette page">
          {#each sections as s (s.id)}
            <a href="#{s.slug}" class="press inline-flex items-center min-h-[44px] px-4 rounded-full border-[1.5px] border-man-marine/30 text-[15px] font-bold text-man-marine hover:bg-man-marine hover:text-white transition-colors duration-200">
              {s.title}
            </a>
          {/each}
        </nav>
      {/if}

      <div class="grid grid-cols-1 gap-16 md:gap-24">
        {#each sections as s, i (s.id)}
          <section id={s.slug} class="scroll-mt-24 flex flex-col gap-6 md:gap-12 md:items-center" class:md:flex-row={i % 2 == 0} class:md:flex-row-reverse={i % 2 == 1}>
            {#if s.imageUrl}
              <img src={cdn(s.imageUrl, 700)} alt={s.title} loading="lazy" class="w-full md:w-2/5 rounded-[26px] object-cover max-h-[28rem]" />
            {/if}
            <div class="w-full" class:md:w-3-5={s.imageUrl}>
              <h2 use:reveal class="font-slab font-bold text-[34px] md:text-[44px] leading-tight text-man-nuit">{s.title}</h2>
              {#if s.subtitle}
                <div class="mt-1 font-bold text-man-ortexte">{s.subtitle}</div>
              {/if}
              {#if s.body}
                <div class="mt-4 text-[17px] text-[#2B3F5C] leading-relaxed whitespace-pre-line max-w-[68ch]">{s.body}</div>
              {/if}
              {#if s.details && s.details.length}
                <dl class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {#each s.details as d}
                    <div class="rounded-2xl bg-[#F1F5FA] px-4 py-3">
                      <dt class="text-sm font-bold text-man-marine">{d.label}</dt>
                      <dd class="mt-1 text-man-nuit break-words select-all">{d.value}</dd>
                    </div>
                  {/each}
                </dl>
              {/if}
              <slot name="after" section={s} />
            </div>
          </section>
        {/each}
      </div>
    {/if}
  </Container>
</div>

<style>
  @media (min-width: 768px) {
    .md\:w-3-5 {
      width: 60%;
    }
  }
</style>
