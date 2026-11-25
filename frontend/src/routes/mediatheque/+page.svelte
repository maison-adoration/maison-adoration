<script>
  import { reveal } from "../../utils/motion";
  import { cdn } from "../../utils/cdn.js";
  import { onMount } from "svelte";
  import api from "../../utils/api";
  import PageHero from "../../components/pages/PageHero.svelte";
  import MediaModal from "../../components/media/MediaModal.svelte";
  import { thumbnailFor } from "../../components/media/embed";
  import { formatDate } from "../../components/admin/media/upload";
  import { clock, messagePath, downloadUrl, shareOrCopy, PODCAST_FEED } from "../../utils/media";

  let data = null;
  let facets = { preachers: [], years: [], books: [], series: [] };
  // Bibliothèque des messages : recherche et filtres (gardés dans l'adresse pour être partagés).
  let f = { search: "", preacher: "", seriesId: "", year: "", book: "" };
  let lib = { items: [], total: 0, page: 1, loading: true, error: false };
  let searchTimer;
  let ready = false;
  let album = null; // album ouvert (avec photos)
  let press = null; // communiqué ouvert
  let photoIndex = null;

  onMount(async () => {
    try {
      data = (await api.get("/media/public/overview")).data;
    } catch (e) {
      data = { sermons: [], series: [], podcasts: [], albums: [], press: [], live: null, upcoming: [], replays: [] };
    }
    const q = new URLSearchParams(location.search);
    // Ancien lien vers un message : /mediatheque?message=<id> → page du message.
    if (q.get("message")) return location.replace(`/message?m=${encodeURIComponent(q.get("message"))}`);
    for (const k of Object.keys(f)) f[k] = q.get(k === "seriesId" ? "serie" : k === "year" ? "annee" : k === "book" ? "livre" : k === "preacher" ? "predicateur" : "q") || "";
    ready = true;
    loadLibrary();
    api.get("/media/public/sermons/facets").then((r) => (facets = r.data)).catch(() => {});
    // Album partagé : /mediatheque?album=<id>
    if (q.get("album")) openAlbum({ id: q.get("album"), title: "Album" });
  });

  const PARAM = { search: "q", preacher: "predicateur", seriesId: "serie", year: "annee", book: "livre" };
  async function loadLibrary(page = 1) {
    lib = { ...lib, loading: true, error: false };
    const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v));
    try {
      const r = (await api.get("/media/public/sermons", { params: { ...params, page } })).data;
      lib = { items: page === 1 ? r.items : [...lib.items, ...r.items], total: r.total, page, loading: false, error: false };
    } catch {
      lib = { ...lib, loading: false, error: true };
    }
    const url = new URL(location.href);
    for (const [k, p] of Object.entries(PARAM)) f[k] ? url.searchParams.set(p, f[k]) : url.searchParams.delete(p);
    history.replaceState(history.state, "", url.pathname + url.search + url.hash);
  }
  const onFilter = () => ready && loadLibrary(1);
  const onSearch = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(onFilter, 300);
  };
  const resetFilters = () => {
    f = { search: "", preacher: "", seriesId: "", year: "", book: "" };
    loadLibrary(1);
  };
  $: activeFilters = Object.values(f).filter(Boolean).length;
  const openAlbum = async (a) => {
    album = { ...a, photos: null };
    try {
      album = (await api.get(`/media/public/albums/${a.id}`)).data;
    } catch (e) {
      album = null;
    }
  };
  let albumNote = "";
  let feedNote = "";
  const copyFeed = async () => {
    try {
      await navigator.clipboard.writeText(PODCAST_FEED);
      feedNote = "Lien du flux copié : collez-le dans votre application de podcast.";
    } catch {
      feedNote = PODCAST_FEED;
    }
  };
  const shareAlbum = async () => {
    const url = `${location.origin}/mediatheque?album=${encodeURIComponent(album.id)}`;
    try {
      const r = await shareOrCopy({ title: album.title, text: `Photos : ${album.title}`, url });
      if (r === "copied") albumNote = "Lien de l'album copié";
    } catch {
      albumNote = "Copie impossible";
    }
    setTimeout(() => (albumNote = ""), 2500);
  };
  const selectClass = "man-input h-[48px] rounded-2xl border-[1.5px] border-[#C9D6E8] bg-white px-3 text-man-nuit font-bold text-[15px] min-w-0";
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
        { id: "sermons", label: "Messages", n: data.sermons.length },
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
      <section id="sermons" class="scroll-mt-28 mb-16" aria-labelledby="t-sermons">
        <div class="flex flex-wrap items-end justify-between gap-3 mb-5">
          <h2 id="t-sermons" use:reveal class="font-slab font-bold text-[32px] md:text-[40px] leading-tight text-man-nuit">Messages</h2>
          <p class="text-[15px] text-[#4A6285]" aria-live="polite">{lib.loading && lib.page === 1 ? "Recherche…" : `${lib.total} message${lib.total > 1 ? "s" : ""}`}</p>
        </div>

        <form role="search" class="grid gap-3 md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))] mb-6" on:submit|preventDefault={onFilter}>
          <div class="flex flex-col gap-1 min-w-0">
            <label for="lib-q" class="text-sm font-bold text-man-nuit">Rechercher</label>
            <input id="lib-q" type="search" bind:value={f.search} on:input={onSearch} placeholder="Titre, thème, passage…" maxlength="120"
              class="man-input h-[48px] rounded-2xl border-[1.5px] border-[#C9D6E8] bg-white px-4 text-man-nuit placeholder:text-[#8A9BB5] min-w-0" />
          </div>
          <div class="flex flex-col gap-1 min-w-0">
            <label for="lib-p" class="text-sm font-bold text-man-nuit">Prédicateur</label>
            <select id="lib-p" bind:value={f.preacher} on:change={onFilter} class={selectClass}>
              <option value="">Tous</option>
              {#each facets.preachers as x}<option value={x.value}>{x.value} ({x.count})</option>{/each}
            </select>
          </div>
          <div class="flex flex-col gap-1 min-w-0">
            <label for="lib-s" class="text-sm font-bold text-man-nuit">Série</label>
            <select id="lib-s" bind:value={f.seriesId} on:change={onFilter} class={selectClass}>
              <option value="">Toutes</option>
              {#each facets.series as x}<option value={x.value}>{x.label} ({x.count})</option>{/each}
            </select>
          </div>
          <div class="flex flex-col gap-1 min-w-0">
            <label for="lib-b" class="text-sm font-bold text-man-nuit">Livre de la Bible</label>
            <select id="lib-b" bind:value={f.book} on:change={onFilter} class={selectClass}>
              <option value="">Tous</option>
              {#each facets.books as x}<option value={x.value}>{x.value} ({x.count})</option>{/each}
            </select>
          </div>
          <div class="flex flex-col gap-1 min-w-0">
            <label for="lib-y" class="text-sm font-bold text-man-nuit">Année</label>
            <select id="lib-y" bind:value={f.year} on:change={onFilter} class={selectClass}>
              <option value="">Toutes</option>
              {#each facets.years as x}<option value={String(x.value)}>{x.value}</option>{/each}
            </select>
          </div>
        </form>
        {#if activeFilters}
          <button type="button" class="mb-5 min-h-[44px] font-bold text-man-marine underline" on:click={resetFilters}>Effacer les filtres ({activeFilters})</button>
        {/if}

        {#if lib.error}
          <p class="rounded-2xl bg-[#FDECEA] text-[#7A1A14] px-4 py-3" role="alert">Les messages n'ont pas pu être chargés. <button type="button" class="font-bold underline" on:click={() => loadLibrary(1)}>Réessayer</button></p>
        {:else if lib.loading && lib.page === 1}
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" aria-hidden="true">
            {#each [0, 1, 2] as _}<div class="h-[300px] rounded-[22px] bg-[#EEF2F8] animate-pulse"></div>{/each}
          </div>
        {:else}
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {#each lib.items as s, i (s.id)}
              <a href={messagePath(s)} class="rowcard block rounded-[22px] overflow-hidden bg-white border border-[#E1E8F1] transition-colors duration-200 hover:border-man-marine">
                <span class="relative block overflow-hidden" style="aspect-ratio: 16 / 9;">
                  <img src={cdn(image(s, i), 600)} alt="" class="rc-img absolute inset-0 w-full h-full object-cover" loading="lazy" />
                  <span aria-hidden="true" class="absolute left-3 bottom-3 w-11 h-11 rounded-full bg-man-or flex items-center justify-center"><svg width="18" height="18" viewBox="0 0 24 24" fill="#0A1B33"><path d="M8 5v14l11-7z" /></svg></span>
                  {#if s.duration_seconds}<span class="absolute right-3 bottom-3 rounded-full bg-man-nuit/85 text-white text-sm font-bold px-2.5 py-1">{clock(s.duration_seconds)}</span>{/if}
                  {#if s.is_featured}<span class="absolute top-3 left-3 text-sm font-bold bg-man-nuit/85 text-white px-3 py-1 rounded-full">À la une</span>{/if}
                </span>
                <span class="block p-5">
                  <span class="block font-slab font-bold text-[21px] leading-tight text-man-nuit">{s.title}</span>
                  <span class="block mt-2 text-[15px] text-[#4A6285]">{[formatDate(s.sermon_date), s.preacher, s.series_name].filter(Boolean).join(", ")}</span>
                  {#if s.scriptures}<span class="block mt-2 text-sm font-bold text-man-marine">{s.scriptures}</span>{/if}
                  {#if s.audio_url}<span class="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-[#1E7A4C]"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M3 14v-2a9 9 0 0118 0v2M21 19a2 2 0 01-2 2h-1v-6h3zM3 19a2 2 0 002 2h1v-6H3z" /></svg>Audio disponible</span>{/if}
                </span>
              </a>
            {:else}
              <div class="sm:col-span-2 lg:col-span-3 rounded-[22px] bg-[#F3F6FA] p-6">
                <p class="font-bold text-man-nuit">Aucun message ne correspond.</p>
                <p class="text-[#4A6285] mt-1">Essayez un autre mot, ou effacez les filtres.</p>
              </div>
            {/each}
          </div>
          {#if lib.items.length < lib.total}
            <div class="mt-8 flex justify-center">
              <button type="button" class="btn-line" disabled={lib.loading} aria-busy={lib.loading} on:click={() => loadLibrary(lib.page + 1)}>
                {lib.loading ? "Chargement…" : `Voir plus (${lib.total - lib.items.length} restants)`}
              </button>
            </div>
          {/if}
        {/if}
      </section>
      {/if}

      {#if data.podcasts.length}
      <section id="podcasts" class="scroll-mt-28 mb-16">
        <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
          <h2 use:reveal class="font-slab font-bold text-[32px] md:text-[40px] leading-tight text-man-nuit">Podcasts</h2>
          <div class="flex flex-wrap items-center gap-3">
            <button type="button" class="btn-line !min-h-[44px]" on:click={copyFeed}>S'abonner au podcast</button>
            <span class="text-sm text-[#4A6285]" role="status" aria-live="polite">{feedNote}</span>
          </div>
        </div>
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
                {#if a.event_title}<span class="block text-sm font-bold text-man-marine mt-1">{a.event_title}</span>{/if}
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

<MediaModal show={Boolean(album)} title={album ? album.title : ""} on:close={() => ((album = null), (photoIndex = null))}>
  {#if album}
    {#if album.description}<p class="text-gray-300 mb-4 whitespace-pre-line">{album.description}</p>{/if}
    <div class="flex flex-wrap items-center gap-3 mb-4">
      {#if album.event_title}<span class="text-man-or font-bold">{album.event_title}</span>{/if}
      <button type="button" class="btn-ghost !min-h-[44px] !px-4" on:click={shareAlbum}>Partager l'album</button>
      <span class="text-sm text-gray-300" role="status" aria-live="polite">{albumNote}</span>
    </div>
    {#if album.photos == null}
      <p class="text-gray-300">Chargement…</p>
    {:else if photoIndex !== null}
      <img src={cdn(album.photos[photoIndex].url, 1200)} alt={album.photos[photoIndex].caption} class="w-full rounded-xl" />
      <div class="flex items-center justify-between mt-3 text-white">
        <button type="button" class="btn-ghost !min-h-[44px] !px-4" aria-label="Photo précédente" disabled={photoIndex == 0} on:click={() => (photoIndex -= 1)}>←</button>
        <span class="text-sm text-center">{album.photos[photoIndex].caption || ""} ({photoIndex + 1}/{album.photos.length})
          <a class="block mt-1 font-bold text-man-or underline" href={downloadUrl(album.photos[photoIndex].url, `${album.title}-${photoIndex + 1}`)} download>Télécharger en haute définition</a></span>
        <button type="button" class="btn-ghost !min-h-[44px] !px-4" aria-label="Photo suivante" disabled={photoIndex == album.photos.length - 1} on:click={() => (photoIndex += 1)}>→</button>
      </div>
      <button class="mt-3 text-sm text-gray-300 underline" on:click={() => (photoIndex = null)}>Toutes les photos</button>
    {:else}
      <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
        {#each album.photos as ph, i (ph.id)}
          <button type="button" aria-label="Agrandir la photo {i + 1}{ph.caption ? ` : ${ph.caption}` : ''}" on:click={() => (photoIndex = i)}>
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
