<script>
  import { reveal, slidePill } from "../../utils/motion";
  import { onMount } from "svelte";
  import api, { CONTENT_TYPES } from "../../utils/api";
  import ConferenceCardForUsers from "../shared/ConferenceCardForUsers.svelte";
  import PdfCard from "../shared/PDFCard.svelte";
  import Container from "../utils/Container.svelte";

  export let isLoggedIn = false;

  let searchkey = "";
  let sType = "";
  let contents = null;

  const CATS = [{ value: "", label: "Tout" }, ...CONTENT_TYPES.map((t) => ({ ...t, label: { video: "Vidéos", podcast: "Podcasts", pdf: "Livres", activity: "Activités" }[t.value] || t.label }))];

  // Recherche au fil de la frappe, après une courte pause.
  let typing;
  const onSearch = () => {
    clearTimeout(typing);
    typing = setTimeout(fetchContents, 350);
  };

  // Numéro de la dernière recherche : une réponse plus ancienne qui arriverait
  // après une plus récente (réseau lent) n'écrase pas les bons résultats.
  let lastRequest = 0;
  const fetchContents = async () => {
    const n = ++lastRequest;
    try {
      const res = await api.get("/contents", {
        params: { search: searchkey || "", ...(sType ? { type: sType } : {}) },
      });
      if (n === lastRequest) contents = res.data;
    } catch (err) {
      if (n === lastRequest) contents = [];
    }
  };

  onMount(() => {
    fetchContents();
  });
</script>

<div id="ressources"></div>


<Container>
  <div class="max-w-[60rem] mx-auto pt-16 md:pt-24 pb-6 text-man-nuit">
    <h2 use:reveal class="font-slab font-bold text-[38px] md:text-[clamp(42px,5vw,64px)] leading-none">Ressources et activités</h2>
    <p class="mt-4 text-lg leading-relaxed text-[#3D5578] max-w-[560px]">
      Programmes, enseignements audio, livres et vidéos de la Maison, à suivre à votre rythme.
    </p>
  </div>

  <div class="max-w-[60rem] mx-auto flex flex-col md:flex-row md:items-center gap-4">
    <div class="flex flex-wrap gap-2" role="group" aria-label="Catégorie" use:slidePill={sType}>
      {#each CATS as c}
        <button
          type="button"
          data-on={sType === c.value}
          aria-pressed={sType === c.value}
          class="press min-h-[44px] px-4 rounded-full border-[1.5px] font-bold text-[15px] transition-colors duration-200 {sType === c.value ? 'border-man-or bg-man-or text-man-nuit' : 'border-[#C9D6E8] text-man-marine hover:border-man-marine'}"
          on:click={() => { sType = c.value; fetchContents(); }}
        >{c.label}</button>
      {/each}
    </div>
    <div class="md:ml-auto md:w-[280px] relative">
      <label for="r-search" class="sr-only">Rechercher une ressource</label>
      <svg class="absolute left-4 top-1/2 -translate-y-1/2 text-[#4A6285] pointer-events-none" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
      <input id="r-search" type="search" bind:value={searchkey} on:input={onSearch} placeholder="Rechercher un titre" autocomplete="off" class="man-input w-full h-12 rounded-full bg-white border-[1.5px] border-[#C9D6E8] pl-11 pr-4 text-man-nuit focus:border-man-marine focus:outline-none" />
    </div>
  </div>

  <div class="max-w-[60rem] mx-auto my-8 pb-16 md:pb-24" aria-live="polite">
    {#if contents == null}
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5" aria-busy="true">
        {#each [0, 1, 2] as _}<div class="h-[340px] rounded-[22px] bg-[#EEF2F8] animate-pulse"></div>{/each}
      </div>
    {:else if contents.length === 0}
      <div class="rounded-[22px] border-[1.5px] border-dashed border-[#C9D6E8] p-8 text-center">
        {#if searchkey || sType}
          <p class="text-lg text-man-nuit">Aucune ressource ne correspond à cette recherche.</p>
          <button type="button" class="btn-line mt-4" on:click={() => { searchkey = ""; sType = ""; fetchContents(); }}>Voir toutes les ressources</button>
        {:else}
          <p class="text-lg text-man-nuit">Les premières ressources arrivent bientôt.</p>
          <p class="mt-1 text-[#4A6285]">Enseignements, livres et podcasts seront proposés ici.</p>
        {/if}
      </div>
    {:else}
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {#each contents as content (content.id)}
          {#if content.type == "pdf"}
            <PdfCard {...content} on:update={fetchContents} {isLoggedIn} />
          {:else}
            <ConferenceCardForUsers {...content} on:update={fetchContents} {isLoggedIn} />
          {/if}
        {/each}
      </div>
    {/if}
  </div>
</Container>
