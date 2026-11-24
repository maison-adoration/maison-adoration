<script>
  import { reveal } from "../../utils/motion";
  import { onMount, onDestroy } from "svelte";
  import api from "../../utils/api";
  import PageHero from "../../components/pages/PageHero.svelte";
  import Container from "../../components/utils/Container.svelte";
  import Loading from "../../components/utils/Loading.svelte";
  import VideoEmbed from "../../components/media/VideoEmbed.svelte";
  import { formatDate } from "../../components/admin/media/upload";

  const TYPE = { culte: "Culte", conference: "Conférence", prayer: "Prière", cours: "Cours" };
  let data = null;
  let timer;

  const load = async () => {
    try {
      data = (await api.get("/media/public/live")).data;
    } catch (e) {
      data = data || { live: null, upcoming: [], replays: [] };
    }
  };

  onMount(() => {
    load();
    // Le direct apparaît sans recharger la page (pas de requête si l'onglet est en arrière-plan).
    timer = setInterval(() => {
      if (!document.hidden) load();
    }, 60000);
  });
  onDestroy(() => clearInterval(timer));
</script>

<svelte:head>
  <title>Direct - M.A.N. - Maison D'Adoration Pour les Nations</title>
</svelte:head>

<PageHero title="En direct" subtitle="Cultes tous les dimanches à 8h30, en personne ou en ligne." />

<div class="bg-white py-10 min-h-[50vh]">
  <Container>
    {#if data == null}
      <Loading text="Veuillez patienter" />
    {:else}
      {#if data.live}
        <div class="mb-12">
          <div class="text-red-600 font-bold mb-2">● EN DIRECT · {TYPE[data.live.type] || ""}</div>
          <h2 use:reveal class="font-slab font-bold text-[32px] md:text-[40px] leading-tight text-man-nuit mb-4">{data.live.title}</h2>
          <VideoEmbed url={data.live.stream_url} title={data.live.title} />
          {#if data.live.description}<p class="mt-4 text-gray-600 whitespace-pre-line">{data.live.description}</p>{/if}
        </div>
      {:else}
        <div class="mb-12 rounded-xl bg-brand-black-light border border-gray-200 p-6 text-center">
          <p class="text-gray-700">Aucun direct en ce moment.</p>
          <a href="https://www.youtube.com/@mantv6688" target="_blank" rel="noopener" class="btn btn-secondary mt-4">
            Notre chaîne YouTube <ion-icon name="logo-youtube" class="text-xl ml-2"></ion-icon>
          </a>
        </div>
      {/if}

      <h2 use:reveal class="font-slab font-bold text-[30px] md:text-[36px] leading-tight text-man-nuit mb-4">Prochains directs</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-12">
        {#each data.upcoming as s (s.id)}
          <div class="rounded-xl border border-gray-200 p-4">
            <div class="text-xs text-gray-500">{TYPE[s.type] || ""} · {formatDate(s.scheduled_at, true)}</div>
            <div class="font-bold text-gray-800">{s.title}</div>
            {#if s.description}<div class="text-sm text-gray-600 mt-1 whitespace-pre-line line-clamp-3">{s.description}</div>{/if}
          </div>
        {:else}
          <p class="text-gray-500">Aucun direct programmé pour le moment.</p>
        {/each}
      </div>

      {#if data.replays.length}
        <h2 use:reveal class="font-slab font-bold text-[30px] md:text-[36px] leading-tight text-man-nuit mb-4">Rediffusions</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          {#each data.replays as s (s.id)}
            <div>
              <VideoEmbed url={s.recording_url} title={s.title} />
              <div class="mt-2 font-bold text-gray-800">{s.title}</div>
              <div class="text-xs text-gray-500">{formatDate(s.ended_at)}</div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </Container>
</div>
