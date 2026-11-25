<script>
  import { reveal, slidePill } from "../../utils/motion";
  import { cdn } from "../../utils/cdn.js";
  import { onMount } from "svelte";
  import api from "../../utils/api";
  import PageHero from "../../components/pages/PageHero.svelte";
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
  // Sans miniature : une photo de la Maison, différente d'une carte à l'autre.
  const FALLBACKS = ["/images/design/predication.jpg", "/images/design/adoration.jpg", "/images/design/assemblee.jpg", "/images/design/enseignement.jpg", "/images/design/fideles.jpg"];
  const image = (s, i = 0) => s.thumbnail_url || thumbnailFor(s.video_url) || FALLBACKS[i % FALLBACKS.length];

  // Rubriques affichées seulement quand elles ont du contenu.
  $: sections = data
    ? [
        { id: "sermons", label: "Sermons", n: data.sermons.length },
        { id: "podcasts", label: "Podcasts", n: data.podcasts.length },
        { id: "galerie", label: "Galerie", n: data.albums.length },
        { id: "communiques", label: "Communiqués", n: data.press.length },
      ].filter((x) => x.n > 0)
    : [];
</script>

<svelte:head>
  <title>Médiathèque - M.A.N. - Maison D'Adoration Pour les Nations</title>
</svelte:head>

<PageHero image="/images/design/predication.jpg" title="Médiathèque" subtitle="Prédications, podcasts, photos et communiqués de la Maison d'Adoration pour les Nations.">
  <nav class="mt-8 flex flex-wrap gap-2 text-[15px] min-h-[44px]" aria-label="Rubriques">
    {#each sections as x}
      <a class="press inline-flex items-center min-h-[44px] px-4 rounded-full border-[1.5px] border-man-bord/60 font-bold hover:border-man-ciel transition-colors duration-200" href="#{x.id}">{x.label}</a>
    {/each}
    <a class="btn-or !min-h-[44px]" href="/live">Directs</a>
  </nav>
</PageHero>

<div class="on-light bg-white py-12 md:py-16 min-h-[50vh]">
  <div class="max-w-[1240px] mx-auto px-5 md:px-10">
    {#if data == null}
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5" aria-busy="true" aria-label="Chargement de la médiathèque">
        {#each [0, 1, 2] as _}<div class="h-[300px] rounded-[22px] bg-[#EEF2F8] animate-pulse"></div>{/each}
      </div>
    {:else}
      {#if data.live}
        <a href="/live" class="press mb-12 flex flex-col sm:flex-row sm:items-center gap-4 rounded-[22px] bg-man-nuit text-white px-6 py-5">
          <span class="inline-flex items-center gap-2 font-extrabold text-man-lumiere"><span class="man-live w-2.5 h-2.5 rounded-full bg-man-lumiere" aria-hidden="true"></span>En direct</span>
          <span class="flex-1 font-slab font-bold text-[22px] leading-tight">{data.live.title}</span>
          <span class="btn-or !min-h-[48px]">Regarder</span>
        </a>
      {/if}

      {#if sections.length === 0}
        <div class="rounded-[26px] bg-[#F3F6FA] p-8 md:p-12 flex flex-col items-start gap-3">
          <h2 class="font-slab font-bold text-[28px] text-man-nuit">La médiathèque se remplit bientôt</h2>
          <p class="text-[17px] text-[#2B3F5C] max-w-[560px]">En attendant, tous les cultes et enseignements sont sur la chaîne YouTube MAN TV.</p>
          <a href="https://www.youtube.com/@mantv6688" target="_blank" rel="noopener" class="btn-or mt-2">Ouvrir MAN TV</a>
        </div>
      {/if}

      {#if data.sermons.length}
      <section id="sermons" class="scroll-mt-28 mb-16">
        <h2 use:reveal class="font-slab font-bold text-[32px] md:text-[40px] leading-tight text-man-nuit mb-6">Sermons</h2>
        {#if data.series.length}
          <div class="flex flex-wrap gap-2 mb-6" role="group" aria-label="Série" use:slidePill={seriesFilter}>
            <button type="button" data-on={!seriesFilter} aria-pressed={!seriesFilter} class="press min-h-[44px] px-4 rounded-full border-[1.5px] font-bold text-[15px] transition-colors duration-200 {!seriesFilter ? 'border-man-or bg-man-or text-man-nuit' : 'border-[#C9D6E8] text-man-marine hover:border-man-marine'}" on:click={() => (seriesFilter = "")}>Tous</button>
            {#each data.series as se (se.id)}
              <button type="button" data-on={seriesFilter == se.id} aria-pressed={seriesFilter == se.id} class="press min-h-[44px] px-4 rounded-full border-[1.5px] font-bold text-[15px] transition-colors duration-200 {seriesFilter == se.id ? 'border-man-or bg-man-or text-man-nuit' : 'border-[#C9D6E8] text-man-marine hover:border-man-marine'}"
                on:click={() => (seriesFilter = se.id)}>{se.name} <span class="font-normal">({se.sermons_count})</span></button>
            {/each}
          </div>
        {/if}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {#each sermons as s, i (s.id)}
            <button type="button" class="rowcard text-left rounded-[22px] overflow-hidden bg-white border border-[#E1E8F1] transition-colors duration-200 hover:border-man-marine" on:click={() => openSermon(s)}>
              <span class="relative block overflow-hidden" style="aspect-ratio: 16 / 9;">
                <img src={cdn(image(s, i), 600)} alt="" class="rc-img absolute inset-0 w-full h-full object-cover" loading="lazy" />
                <span aria-hidden="true" class="absolute right-3 bottom-3 w-11 h-11 rounded-full bg-man-or flex items-center justify-center"><svg width="18" height="18" viewBox="0 0 24 24" fill="#0A1B33"><path d="M8 5v14l11-7z" /></svg></span>
                {#if s.is_featured}<span class="absolute top-3 left-3 text-sm font-bold bg-man-nuit/85 text-white px-3 py-1 rounded-full">À la une</span>{/if}
              </span>
              <span class="block p-5">
                <span class="block font-slab font-bold text-[21px] leading-tight text-man-nuit">{s.title}</span>
                <span class="block mt-2 text-[15px] text-[#4A6285]">
                  {[formatDate(s.sermon_date), s.preacher, s.series_name].filter(Boolean).join(", ")}
                </span>
              </span>
            </button>
          {:else}
            <p class="text-[#4A6285]">Aucun sermon dans cette série pour le moment.</p>
          {/each}
        </div>
      </section>
      {/if}

      {#if data.podcasts.length}
      <section id="podcasts" class="scroll-mt-28 mb-16">
        <h2 use:reveal class="font-slab font-bold text-[32px] md:text-[40px] leading-tight text-man-nuit mb-6">Podcasts</h2>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {#each data.podcasts as p (p.id)}
            <div class="flex gap-4 rounded-[22px] bg-[#F3F6FA] p-4">
              <img src={p.thumbnail_url ? cdn(p.thumbnail_url, 160) : "/images/design/adoration-800.jpg"} alt="" class="w-20 h-20 md:w-24 md:h-24 shrink-0 rounded-2xl object-cover" loading="lazy" />
              <div class="flex-1 min-w-0">
                <div class="text-sm font-bold text-man-marine">Saison {p.season_number}{p.episode_number ? `, épisode ${p.episode_number}` : ""}</div>
                <div class="font-slab font-bold text-[19px] leading-tight text-man-nuit">{p.title}</div>
                {#if p.description}<div class="text-[15px] text-[#4A6285] mt-1 line-clamp-2 whitespace-pre-line">{p.description}</div>{/if}
                <audio controls preload="none" src={p.audio_url} class="w-full mt-3" on:play={() => onPlay(p)}></audio>
              </div>
            </div>
          {/each}
        </div>
      </section>
      {/if}

      {#if data.albums.length}
      <section id="galerie" class="scroll-mt-28 mb-16">
        <h2 use:reveal class="font-slab font-bold text-[32px] md:text-[40px] leading-tight text-man-nuit mb-6">Galerie</h2>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {#each data.albums as a, i (a.id)}
            <button type="button" class="rowcard text-left rounded-[22px] overflow-hidden bg-white border border-[#E1E8F1] transition-colors duration-200 hover:border-man-marine" on:click={() => openAlbum(a)}>
              <span class="block overflow-hidden"><img src={a.cover ? cdn(a.cover, 450) : FALLBACKS[i % FALLBACKS.length]} alt="" class="rc-img w-full aspect-[4/3] object-cover" loading="lazy" /></span>
              <span class="block p-4">
                <span class="block font-bold text-man-nuit leading-snug">{a.title}</span>
                <span class="block text-sm text-[#4A6285] mt-1">{a.event_date ? formatDate(a.event_date) + ", " : ""}{a.photos_count} photo{a.photos_count > 1 ? "s" : ""}</span>
              </span>
            </button>
          {/each}
        </div>
      </section>
      {/if}

      {#if data.press.length}
      <section id="communiques" class="scroll-mt-28">
        <h2 use:reveal class="font-slab font-bold text-[32px] md:text-[40px] leading-tight text-man-nuit mb-6">Communiqués</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          {#each data.press as p (p.id)}
            <button type="button" class="text-left rounded-[22px] bg-[#F3F6FA] p-5 flex gap-4 border-[1.5px] border-transparent hover:border-man-marine transition-colors duration-200" on:click={() => openPress(p)}>
              {#if p.cover_image_url}<img src={cdn(p.cover_image_url, 200)} alt="" class="w-24 h-24 shrink-0 rounded-2xl object-cover" loading="lazy" />{/if}
              <span class="block">
                <span class="block text-sm font-bold text-man-marine">{formatDate(p.published_at)}</span>
                <span class="block font-slab font-bold text-[19px] leading-tight text-man-nuit mt-1">{p.title}</span>
                {#if p.excerpt}<span class="block text-[15px] text-[#4A6285] mt-1 line-clamp-3">{p.excerpt}</span>{/if}
              </span>
            </button>
          {/each}
        </div>
      </section>
      {/if}
    {/if}
  </div>
</div>

<style>
  .rc-img { transition: transform 320ms cubic-bezier(.23,1,.32,1); }
  @media (hover: hover) and (pointer: fine) { .rowcard:hover .rc-img { transform: scale(1.04); } }
  @media (prefers-reduced-motion: reduce) { .rc-img { transition: none; } }
</style>

<MediaModal show={Boolean(sermon)} title={sermon ? sermon.title : ""} on:close={() => (sermon = null)}>
  {#if sermon}
    {#if sermon.video_url}<VideoEmbed url={sermon.video_url} title={sermon.title} />{/if}
    {#if sermon.audio_url}<audio controls src={sermon.audio_url} class="w-full mt-4"></audio>{/if}
    <div class="mt-4 text-gray-200 text-sm">
      {formatDate(sermon.sermon_date)}{sermon.preacher ? ` · ${sermon.preacher}` : ""}
    </div>
    {#if sermon.description}<div class="mt-2 text-gray-300 whitespace-pre-line">{sermon.description}</div>{/if}
    {#if sermon.pdf_url}
      <a class="btn-or mt-5" href={sermon.pdf_url} target="_blank" rel="noopener">Notes du message (PDF)</a>
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
        <button type="button" class="btn-ghost !min-h-[44px] !px-4" aria-label="Photo précédente" disabled={photoIndex == 0} on:click={() => (photoIndex -= 1)}>←</button>
        <span class="text-sm">{album.photos[photoIndex].caption || ""} ({photoIndex + 1}/{album.photos.length})</span>
        <button type="button" class="btn-ghost !min-h-[44px] !px-4" aria-label="Photo suivante" disabled={photoIndex == album.photos.length - 1} on:click={() => (photoIndex += 1)}>→</button>
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
