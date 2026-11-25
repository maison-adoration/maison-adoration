<script>
  import { onMount } from "svelte";
  import api, { errorMessage } from "../../../utils/api";
  import Loading from "../../utils/Loading.svelte";
  import { formatDate } from "./upload";

  let data = null;
  onMount(async () => {
    try {
      data = (await api.get("/media/dashboard")).data;
    } catch (err) {
      alert(errorMessage(err));
    }
  });

  $: cards = data
    ? [
        { label: "Sermons publiés", value: data.stats.publishedSermons, sub: `${data.stats.draftSermons} brouillon(s)` },
        { label: "Vues des sermons", value: data.stats.totalViews },
        { label: "Albums publiés", value: data.stats.publishedAlbums, sub: `${data.stats.totalPhotos} photo(s)` },
        { label: "Épisodes publiés", value: data.stats.publishedPodcasts, sub: `${data.stats.totalPlays} écoute(s)` },
        { label: "Communiqués publiés", value: data.stats.publishedPress },
        { label: "Directs", value: data.stats.liveStreams, sub: `${data.stats.scheduledStreams} programmé(s)` },
      ]
    : [];
</script>

{#if data == null}
  <Loading text="Veuillez patienter" />
{:else}
  <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
    {#each cards as c}
      <div class="bg-white rounded-xl border border-gray-200 px-4 py-3">
        <div class="text-xs uppercase tracking-wider text-gray-600">{c.label}</div>
        <div class="text-3xl text-brand-primary h-font">{c.value}</div>
        {#if c.sub}<div class="text-xs text-gray-600">{c.sub}</div>{/if}
      </div>
    {/each}
  </div>
  {#if data.stats.incompleteSermons > 0}
    <p class="mb-4 text-sm text-orange-700">
      ⚠ {data.stats.incompleteSermons} sermon(s) sans miniature ou sans vidéo/audio.
    </p>
  {/if}
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <div class="font-bold text-gray-700 mb-2">Derniers sermons</div>
      {#each data.recentSermons as s}
        <div class="text-sm py-1 border-b border-gray-200">{s.title} <span class="text-gray-600">· {formatDate(s.sermon_date)}</span></div>
      {:else}<div class="text-sm text-gray-600">Aucun sermon.</div>{/each}
    </div>
    <div>
      <div class="font-bold text-gray-700 mb-2">Directs à venir</div>
      {#each data.upcomingStreams as s}
        <div class="text-sm py-1 border-b border-gray-200">
          {#if s.is_live}<span class="text-red-600 font-bold">● EN DIRECT</span>{/if}
          {s.title} <span class="text-gray-600">· {formatDate(s.scheduled_at, true)}</span>
        </div>
      {:else}<div class="text-sm text-gray-600">Aucun direct programmé.</div>{/each}
    </div>
  </div>
{/if}
