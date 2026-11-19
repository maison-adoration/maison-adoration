<script>
  // Affiche les sections publiées d'une page (modifiables dans l'espace admin).
  import { onMount } from "svelte";
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
  });
</script>

<div class="bg-white py-10">
  <Container>
    {#if sections == null}
      <Loading text="Veuillez patienter" />
    {:else if sections.length == 0}
      <p class="text-center text-gray-500 py-16">{emptyText}</p>
    {:else}
      {#if showNav && sections.length > 1}
        <nav class="flex flex-wrap justify-center gap-2 mb-10">
          {#each sections as s (s.id)}
            <a href="#{s.slug}" class="px-3 py-1 rounded-full border border-brand-primary/40 text-sm text-brand-primary hover:bg-brand-primary hover:text-white transition">
              {s.title}
            </a>
          {/each}
        </nav>
      {/if}

      <div class="grid grid-cols-1 gap-14">
        {#each sections as s, i (s.id)}
          <section id={s.slug} class="scroll-mt-24 flex flex-col gap-6 md:items-start" class:md:flex-row={i % 2 == 0} class:md:flex-row-reverse={i % 2 == 1}>
            {#if s.imageUrl}
              <img src={s.imageUrl} alt={s.title} loading="lazy" class="w-full md:w-2/5 rounded-xl shadow-md object-cover max-h-[26rem]" />
            {/if}
            <div class="w-full" class:md:w-3-5={s.imageUrl}>
              <h2 class="h-font text-4xl text-brand-primary uppercase">{s.title}</h2>
              {#if s.subtitle}
                <div class="mt-1 text-gray-500 tracking-wider">{s.subtitle}</div>
              {/if}
              {#if s.body}
                <div class="mt-4 text-gray-700 leading-relaxed whitespace-pre-line">{s.body}</div>
              {/if}
              {#if s.details && s.details.length}
                <dl class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {#each s.details as d}
                    <div class="rounded-lg bg-brand-black-light border border-gray-200 px-4 py-3">
                      <dt class="text-xs uppercase tracking-wider text-gray-500">{d.label}</dt>
                      <dd class="mt-1 text-gray-800 break-words select-all">{d.value}</dd>
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
