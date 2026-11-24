<script>
  import { cdn } from "../../utils/cdn.js";
  import { onMount } from "svelte";
  import api from "../../utils/api";
  import PageHero from "../../components/pages/PageHero.svelte";
  import Container from "../../components/utils/Container.svelte";
  import Loading from "../../components/utils/Loading.svelte";
  import VideoEmbed from "../../components/media/VideoEmbed.svelte";
  import MediaModal from "../../components/media/MediaModal.svelte";
  import { thumbnailFor } from "../../components/media/embed";
  import { formatDate } from "../../components/admin/media/upload";

  let data = null;
  let seriesFilter = "";
  let sermon = null; // sermon ouvert
  let album = null; // album ouvert (avec photos)
  let press = null; // communiqué ouvert
  let photoIndex = null;

  onMount(async () => {
    try {
      data = (await api.get("/media/public/overview")).data;
    } catch (e) {
      data = { sermons: [], series: [], podcasts: [], albums: [], press: [], live: null, upcoming: [], replays: [] };
    }
    // Lien direct vers un message (depuis l'accueil) : /mediatheque?message=<id>
    const wanted = new URLSearchParams(location.search).get("message");
    const found = wanted && data.sermons.find((s) => String(s.id) === wanted);
    if (found) openSermon(found);
  });

  $: sermons = data ? data.sermons.filter((s) => !seriesFilter || s.series_id == seriesFilter) : [];

  const openSermon = (s) => {
    sermon = s;
    api.post(`/media/public/sermons/${s.id}/view`).catch(() => {});
  };
  const openAlbum = async (a) => {
    album = { ...a, photos: null };
    try {
      album = (await api.get(`/media/public/albums/${a.id}`)).data;
    } catch (e) {
      album = null;
    }
  };
  const openPress = async (p) => {
    press = { ...p, content: null };
    try {
      press = (await api.get(`/media/public/press/${p.id}`)).data;
    } catch (e) {
      press = null;
    }
  };
  const played = new Set();
  const onPlay = (p) => {
    if (played.has(p.id)) return;
    played.add(p.id);
    api.post(`/media/public/podcasts/${p.id}/play`).catch(() => {});
  };
  const image = (s) => s.thumbnail_url || thumbnailFor(s.video_url) || "/images/man-tv.jpg";
</script>

<svelte:head>
  <title>Médiathèque - M.A.N. - Maison D'Adoration Pour les Nations</title>
</svelte:head>

<PageHero image="/images/design/predication.jpg" title="Médiathèque" subtitle="Prédications, podcasts, photos et communiqués de la Maison d'Adoration pour les Nations.">
  <nav class="mt-8 flex flex-wrap gap-2 text-[15px]" aria-label="Rubriques">
    <a class="press inline-flex items-center min-h-[44px] px-4 rounded-full border-[1.5px] border-man-bord/60 font-bold hover:border-man-ciel transition-colors duration-200" href="#sermons">Sermons</a>
    <a class="press inline-flex items-center min-h-[44px] px-4 rounded-full border-[1.5px] border-man-bord/60 font-bold hover:border-man-ciel transition-colors duration-200" href="#podcasts">Podcasts</a>
    <a class="press inline-flex items-center min-h-[44px] px-4 rounded-full border-[1.5px] border-man-bord/60 font-bold hover:border-man-ciel transition-colors duration-200" href="#galerie">Galerie</a>
    <a class="press inline-flex items-center min-h-[44px] px-4 rounded-full border-[1.5px] border-man-bord/60 font-bold hover:border-man-ciel transition-colors duration-200" href="#communiques">Communiqués</a>
    <a class="btn-or !min-h-[44px]" href="/live">Directs</a>
  </nav>
</PageHero>

<div class="bg-white py-10 min-h-[50vh]">
  <Container>
    {#if data == null}
      <Loading text="Veuillez patienter" />
    {:else}
      {#if data.live}
        <a href="/live" class="block mb-8 rounded-xl bg-red-600 text-white px-4 py-3 text-center">
          🔴 En direct maintenant : <strong>{data.live.title}</strong> — cliquez pour regarder
        </a>
      {/if}

      <!-- SERMONS -->
      <section id="sermons" class="scroll-mt-24 mb-14">
        <h2 class="font-slab font-bold text-[32px] md:text-[40px] leading-tight text-man-nuit mb-5">Sermons</h2>
        {#if data.series.length}
          <div class="flex flex-wrap gap-2 mb-4 text-sm">
            <button class="px-3 py-1 rounded-full border" class:bg-brand-primary={!seriesFilter} class:text-white={!seriesFilter} on:click={() => (seriesFilter = "")}>Tous</button>
            {#each data.series as se (se.id)}
              <button class="px-3 py-1 rounded-full border" class:bg-brand-primary={seriesFilter == se.id} class:text-white={seriesFilter == se.id}
                on:click={() => (seriesFilter = se.id)}>{se.name} ({se.sermons_count})</button>
            {/each}
          </div>
        {/if}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {#each sermons as s (s.id)}
            <button class="text-left rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition bg-brand-black-light" on:click={() => openSermon(s)}>
              <div class="relative" style="aspect-ratio: 16 / 9;">
                <img src={cdn(image(s), 450)} alt={s.title} class="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                {#if s.is_featured}<span class="absolute top-2 left-2 text-xs bg-brand-primary text-white px-2 py-1 rounded">À la une</span>{/if}
              </div>
              <div class="p-3">
                <div class="font-bold text-gray-800">{s.title}</div>
                <div class="text-xs text-gray-500 mt-1">
                  {formatDate(s.sermon_date)}{s.preacher ? ` · ${s.preacher}` : ""}{s.series_name ? ` · ${s.series_name}` : ""}
                </div>
              </div>
            </button>
          {:else}
            <p class="text-gray-500">Les prédications seront bientôt disponibles ici.</p>
          {/each}
        </div>
      </section>

      <!-- PODCASTS -->
      <section id="podcasts" class="scroll-mt-24 mb-14">
        <h2 class="font-slab font-bold text-[32px] md:text-[40px] leading-tight text-man-nuit mb-5">Podcasts</h2>
        <div class="grid grid-cols-1 gap-3">
          {#each data.podcasts as p (p.id)}
            <div class="flex flex-col sm:flex-row gap-3 sm:items-center rounded-xl border border-gray-200 p-3">
              {#if p.thumbnail_url}<img src={cdn(p.thumbnail_url, 100)} alt="" class="w-20 h-20 rounded object-cover" loading="lazy" />{/if}
              <div class="flex-1">
                <div class="font-bold text-gray-800">{p.title}</div>
                <div class="text-xs text-gray-500">Saison {p.season_number}{p.episode_number ? ` · épisode ${p.episode_number}` : ""}</div>
                {#if p.description}<div class="text-sm text-gray-600 mt-1 line-clamp-2 whitespace-pre-line">{p.description}</div>{/if}
                <audio controls preload="none" src={p.audio_url} class="w-full mt-2" on:play={() => onPlay(p)}></audio>
              </div>
            </div>
          {:else}
            <p class="text-gray-500">Aucun épisode pour le moment.</p>
          {/each}
        </div>
      </section>

      <!-- GALERIE -->
      <section id="galerie" class="scroll-mt-24 mb-14">
        <h2 class="font-slab font-bold text-[32px] md:text-[40px] leading-tight text-man-nuit mb-5">Galerie</h2>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {#each data.albums as a (a.id)}
            <button class="text-left rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition" on:click={() => openAlbum(a)}>
              <img src={cdn(a.cover, 450) || "/images/man-tv.jpg"} alt={a.title} class="w-full h-36 object-cover" loading="lazy" />
              <div class="p-2">
                <div class="font-bold text-sm text-gray-800">{a.title}</div>
                <div class="text-xs text-gray-500">{a.event_date ? formatDate(a.event_date) + " · " : ""}{a.photos_count} photo(s)</div>
              </div>
            </button>
          {:else}
            <p class="col-span-full text-gray-500">Aucun album pour le moment.</p>
          {/each}
        </div>
      </section>

      <!-- COMMUNIQUÉS -->
      <section id="communiques" class="scroll-mt-24">
        <h2 class="font-slab font-bold text-[32px] md:text-[40px] leading-tight text-man-nuit mb-5">Communiqués</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          {#each data.press as p (p.id)}
            <button class="text-left rounded-xl border border-gray-200 p-4 hover:shadow-md transition flex gap-3" on:click={() => openPress(p)}>
              {#if p.cover_image_url}<img src={cdn(p.cover_image_url, 120)} alt="" class="w-24 h-24 rounded object-cover" loading="lazy" />{/if}
              <div>
                <div class="text-xs text-gray-500">{formatDate(p.published_at)}</div>
                <div class="font-bold text-gray-800">{p.title}</div>
                {#if p.excerpt}<div class="text-sm text-gray-600 mt-1 line-clamp-3">{p.excerpt}</div>{/if}
              </div>
            </button>
          {:else}
            <p class="text-gray-500">Aucun communiqué pour le moment.</p>
          {/each}
        </div>
      </section>
    {/if}
  </Container>
</div>

<MediaModal show={Boolean(sermon)} title={sermon ? sermon.title : ""} on:close={() => (sermon = null)}>
  {#if sermon}
    {#if sermon.video_url}<VideoEmbed url={sermon.video_url} title={sermon.title} />{/if}
    {#if sermon.audio_url}<audio controls src={sermon.audio_url} class="w-full mt-4"></audio>{/if}
    <div class="mt-4 text-gray-200 text-sm">
      {formatDate(sermon.sermon_date)}{sermon.preacher ? ` · ${sermon.preacher}` : ""}
    </div>
    {#if sermon.description}<div class="mt-2 text-gray-300 whitespace-pre-line">{sermon.description}</div>{/if}
    {#if sermon.pdf_url}
      <a class="btn btn-secondary mt-4" href={sermon.pdf_url} target="_blank" rel="noopener">Notes du message (PDF)</a>
    {/if}
  {/if}
</MediaModal>

<MediaModal show={Boolean(album)} title={album ? album.title : ""} on:close={() => ((album = null), (photoIndex = null))}>
  {#if album}
    {#if album.description}<p class="text-gray-300 mb-4 whitespace-pre-line">{album.description}</p>{/if}
    {#if album.photos == null}
      <p class="text-gray-300">Chargement…</p>
    {:else if photoIndex !== null}
      <img src={cdn(album.photos[photoIndex].url, 1200)} alt={album.photos[photoIndex].caption} class="w-full rounded-xl" />
      <div class="flex items-center justify-between mt-3 text-white">
        <button class="btn btn-aurora" disabled={photoIndex == 0} on:click={() => (photoIndex -= 1)}>←</button>
        <span class="text-sm">{album.photos[photoIndex].caption || ""} ({photoIndex + 1}/{album.photos.length})</span>
        <button class="btn btn-aurora" disabled={photoIndex == album.photos.length - 1} on:click={() => (photoIndex += 1)}>→</button>
      </div>
      <button class="mt-3 text-sm text-gray-300 underline" on:click={() => (photoIndex = null)}>Toutes les photos</button>
    {:else}
      <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
        {#each album.photos as ph, i (ph.id)}
          <button on:click={() => (photoIndex = i)}>
            <img src={cdn(ph.url, 300)} alt={ph.caption} class="w-full h-40 object-cover rounded" loading="lazy" />
          </button>
        {/each}
      </div>
    {/if}
  {/if}
</MediaModal>

<MediaModal show={Boolean(press)} title={press ? press.title : ""} on:close={() => (press = null)}>
  {#if press}
    <div class="bg-white rounded-xl p-5 text-gray-800">
      {#if press.cover_image_url}<img src={cdn(press.cover_image_url, 900)} alt="" class="w-full max-h-80 object-cover rounded mb-4" />{/if}
      <div class="text-xs text-gray-500 mb-3">{formatDate(press.published_at)}</div>
      {#if press.content == null}<p>Chargement…</p>{:else}<div class="whitespace-pre-line leading-relaxed">{press.content}</div>{/if}
    </div>
  {/if}
</MediaModal>
