<script>
  import { onMount } from "svelte";
  import config from "../../stores/config";
  import api, { getToken } from "../../utils/api";
  import MemberHeader from "../../components/member/MemberHeader.svelte";
  import FormAlert from "../../components/auth/FormAlert.svelte";
  import ConferenceCardForUsers from "../../components/shared/ConferenceCardForUsers.svelte";
  import PdfCard from "../../components/shared/PDFCard.svelte";

  let contents = null;
  let failed = false;
  let welcome = false;

  const load = async () => {
    failed = false;
    try {
      contents = (await api.get("/contents/mine")).data;
    } catch (err) {
      if (err?.response?.status === 401) return (window.location = "/login");
      failed = true;
    }
  };

  onMount(() => {
    if (!getToken()) return (window.location = "/login");
    const q = new URLSearchParams(location.search);
    if (q.get("bienvenue")) {
      welcome = true;
      history.replaceState(null, "", "/mes-contenus");
    }
    load();
  });
</script>

<svelte:head>
  <title>Mes contenus - M.A.N. - Maison D'Adoration Pour les Nations</title>
</svelte:head>

<MemberHeader />

<div class="on-light bg-[#F3F6FA] min-h-[60vh] py-10 md:py-14">
  <div class="max-w-[1040px] mx-auto px-5 md:px-10">
    {#if welcome}
      <div class="mb-6"><FormAlert light kind="success" message="Votre compte est créé. Bienvenue dans la Maison !" /></div>
    {/if}

    {#if failed}
      <div class="rounded-[26px] bg-white p-8 flex flex-col items-start gap-4">
        <p class="text-lg text-man-nuit">Vos contenus n'ont pas pu être chargés. Vérifiez votre connexion internet.</p>
        <button type="button" class="btn-line" on:click={load}>Réessayer</button>
      </div>
    {:else if contents === null}
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5" aria-busy="true" aria-label="Chargement de vos contenus">
        {#each [0, 1, 2] as _}<div class="h-[300px] rounded-[22px] bg-white animate-pulse"></div>{/each}
      </div>
    {:else if contents.length === 0}
      <div class="rounded-[26px] bg-white overflow-hidden grid md:grid-cols-[1fr_1.1fr]">
        <img src="/images/design/enseignement.jpg" alt="" loading="lazy" class="w-full h-[200px] md:h-full object-cover" />
        <div class="p-7 md:p-10 flex flex-col items-start gap-3">
          <h2 class="font-slab font-bold text-[28px] leading-tight text-man-nuit">Aucun contenu pour l'instant</h2>
          <p class="text-[17px] leading-relaxed text-[#2B3F5C]">Les enseignements, livres et programmes que vous achetez ou recevez apparaissent ici, prêts à être suivis.</p>
          <a href="/#ressources" class="btn-or mt-3">Voir les ressources</a>
        </div>
      </div>
    {:else}
      <h2 class="sr-only">Mes contenus</h2>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {#each contents as content (content.id)}
          {#if content.type == "pdf"}
            <PdfCard {...content} isLoggedIn={Boolean($config.currentUser)} />
          {:else}
            <ConferenceCardForUsers {...content} isLoggedIn={Boolean($config.currentUser)} />
          {/if}
        {/each}
      </div>
    {/if}
  </div>
</div>
