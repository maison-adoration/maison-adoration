<script>
  import { reveal } from "../../utils/motion";
  import Select from "svelte-select";
  import config from "../../stores/config";
  import Loading from "../utils/Loading.svelte";
  import Empty from "../utils/Empty.svelte";
  import { onMount } from "svelte";
  import api, { CONTENT_TYPES } from "../../utils/api";
  import ConferenceCardForUsers from "../shared/ConferenceCardForUsers.svelte";
  import PdfCard from "../shared/PDFCard.svelte";
  import Container from "../utils/Container.svelte";

  export let isLoggedIn = false;

  let searchkey = "";
  let sType = "";
  let contents = null;

  // Titres proposés dans la recherche (filtrés par catégorie si choisie)
  $: titles = ($config.titles || [])
    .filter((t) => !sType || t.type == sType)
    .map((t) => t.title);

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

  // Les titres ne servent qu'à cette recherche : chargés ici, une seule fois,
  // plutôt que sur toutes les pages du site.
  const fetchTitles = () => {
    if ($config.titles?.length) return;
    api.get("/contents/titles")
      .then((r) => config.update((p) => ({ ...p, titles: r.data })))
      .catch(() => {});
  };

  onMount(() => {
    fetchContents();
    fetchTitles();
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

  <div
    class="mx-auto max-w-[60rem] py-5 px-4 shadow-sm rounded-xl bg-white grid grid-cols-1 md:grid-cols-3 gap-4"
  >
    <div class="select-item-1">
      <Select
        items={CONTENT_TYPES}
        on:select={(e) => {
          sType = e.detail.value;
          fetchContents();
        }}
        on:clear={() => {
          sType = "";
          fetchContents();
        }}
        placeholder="Catégorie"
      />
    </div>

    <Select
      items={titles}
      on:select={(e) => {
        searchkey = e.detail.value;
        fetchContents();
      }}
      placeholder="Que cherchez-vous ?"
    />

    <div class="flex items-center justify-center">
      <input
        type="text"
        bind:value={searchkey}
        placeholder="Terme de recherche"
        on:keydown={(e) => e.key === "Enter" && fetchContents()}
      />
      <button class="ml-1 btn btn-secondary !px-3" on:click={fetchContents} aria-label="Rechercher">
        <ion-icon name="search-outline" class="text-xl"></ion-icon>
      </button>
    </div>
  </div>

  {#if contents == null}
    <Loading text="Veuillez Patienter" />
  {:else}
    <div class="my-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each contents as content (content.id)}
        {#if content.type == "pdf"}
          <PdfCard {...content} on:update={fetchContents} {isLoggedIn} />
        {:else}
          <ConferenceCardForUsers {...content} on:update={fetchContents} {isLoggedIn} />
        {/if}
      {:else}
        <div class="col-span-full">
          <Empty text="Aucun contenu pour le moment" />
        </div>
      {/each}
    </div>
  {/if}
</Container>
