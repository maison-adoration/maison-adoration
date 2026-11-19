<script>
  // Espace de l'équipe média (rôles media, admin, super-admin).
  import api from "../../../utils/api";
  import MediaCrud from "./MediaCrud.svelte";
  import AlbumPhotos from "./AlbumPhotos.svelte";
  import MediaDashboard from "./MediaDashboard.svelte";
  import { formatDate } from "./upload";

  const TABS = [
    ["dashboard", "Tableau de bord"],
    ["sermons", "Sermons"],
    ["series", "Séries"],
    ["gallery", "Galerie"],
    ["podcasts", "Podcasts"],
    ["press", "Communiqués"],
    ["streams", "Directs"],
  ];
  let tab = "dashboard";

  // Séries proposées dans le formulaire des sermons
  let seriesOptions = [{ value: "", label: "— Aucune série —" }];
  const loadSeries = async () => {
    try {
      const res = await api.get("/media/series");
      seriesOptions = [{ value: "", label: "— Aucune série —" }, ...res.data.map((s) => ({ value: s.id, label: s.name }))];
    } catch (e) {
      /* liste vide */
    }
  };
  loadSeries();

  const PLATFORMS = [
    { value: "youtube", label: "YouTube" },
    { value: "facebook", label: "Facebook" },
    { value: "custom", label: "Autre lien" },
  ];
  const STREAM_TYPES = [
    { value: "culte", label: "Culte" },
    { value: "conference", label: "Conférence" },
    { value: "prayer", label: "Prière" },
    { value: "cours", label: "Cours" },
  ];
  const typeLabel = (v) => (STREAM_TYPES.find((t) => t.value === v) || {}).label || v;

  const sermonFields = [
    { key: "title", col: "title", label: "Titre", required: true },
    { key: "preacher", col: "preacher", label: "Prédicateur", placeholder: "Prophète Israel Kayembe" },
    { key: "sermonDate", col: "sermon_date", label: "Date du message", type: "date", required: true },
    { key: "seriesId", col: "series_id", label: "Série", type: "select", nullable: true, options: () => seriesOptions },
    { key: "videoUrl", col: "video_url", label: "Lien vidéo (YouTube, Facebook…)", type: "url" },
    { key: "audioUrl", col: "audio_url", label: "Audio", type: "upload", kind: "audio" },
    { key: "pdfUrl", col: "pdf_url", label: "Notes (PDF)", type: "upload", kind: "pdf" },
    { key: "thumbnailUrl", col: "thumbnail_url", label: "Miniature", type: "upload", kind: "image", help: "Vide : la miniature YouTube est utilisée sur le site." },
    { key: "description", col: "description", label: "Description", type: "textarea" },
    { key: "isFeatured", col: "is_featured", label: "Mettre en avant", type: "checkbox" },
  ];
  const seriesFields = [
    { key: "name", col: "name", label: "Nom de la série", required: true },
    { key: "description", col: "description", label: "Description", type: "textarea", rows: 4 },
    { key: "coverImageUrl", col: "cover_image_url", label: "Image de couverture", type: "upload", kind: "image" },
    { key: "isActive", col: "is_active", label: "Série active (visible sur le site)", type: "checkbox", default: true },
  ];
  const albumFields = [
    { key: "title", col: "title", label: "Titre de l'album", required: true },
    { key: "eventDate", col: "event_date", label: "Date de l'événement", type: "date" },
    { key: "description", col: "description", label: "Description", type: "textarea", rows: 3 },
    { key: "coverImageUrl", col: "cover_image_url", label: "Couverture", type: "upload", kind: "image", help: "Vide : la première photo sert de couverture." },
  ];
  const podcastFields = [
    { key: "title", col: "title", label: "Titre de l'épisode", required: true },
    { key: "audioUrl", col: "audio_url", label: "Fichier audio", type: "upload", kind: "audio", required: true },
    { key: "seasonNumber", col: "season_number", label: "Saison", type: "number", required: true, default: 1 },
    { key: "episodeNumber", col: "episode_number", label: "Numéro d'épisode", type: "number" },
    { key: "thumbnailUrl", col: "thumbnail_url", label: "Image", type: "upload", kind: "image" },
    { key: "description", col: "description", label: "Description", type: "textarea" },
  ];
  const pressFields = [
    { key: "title", col: "title", label: "Titre", required: true },
    { key: "excerpt", col: "excerpt", label: "Résumé (affiché dans la liste)", type: "textarea", rows: 2 },
    { key: "content", col: "content", label: "Texte du communiqué", type: "textarea", rows: 12, required: true },
    { key: "coverImageUrl", col: "cover_image_url", label: "Image", type: "upload", kind: "image" },
    { key: "tags", col: "tags", label: "Mots-clés (séparés par des virgules)", type: "tags" },
  ];
  const streamFields = [
    { key: "title", col: "title", label: "Titre", required: true },
    { key: "type", col: "type", label: "Type", type: "select", options: () => STREAM_TYPES, default: "culte" },
    { key: "platform", col: "platform", label: "Plateforme", type: "select", options: () => PLATFORMS, default: "youtube" },
    { key: "streamUrl", col: "stream_url", label: "Lien du direct", type: "url", help: "Obligatoire pour lancer le direct." },
    { key: "scheduledAt", col: "scheduled_at", label: "Date et heure prévues", type: "datetime" },
    { key: "thumbnailUrl", col: "thumbnail_url", label: "Image", type: "upload", kind: "image" },
    { key: "recordingUrl", col: "recording_url", label: "Lien de la rediffusion (après le direct)", type: "url" },
    { key: "description", col: "description", label: "Description", type: "textarea", rows: 3 },
  ];

  let openAlbum = null;

  const streamAction = async (s, action, reload) => {
    try {
      await api.post(`/media/streams/${s.id}/${action}`);
      reload();
    } catch (err) {
      alert((err.response && err.response.data && err.response.data.error) || "Erreur");
    }
  };
</script>

<div class="flex flex-wrap gap-2 mb-5">
  {#each TABS as [id, label]}
    <button class="px-3 py-1 rounded-full border text-sm" class:bg-brand-primary={tab == id} class:text-white={tab == id}
      on:click={() => ((tab = id), (openAlbum = null))}>{label}</button>
  {/each}
  <a href="/mediatheque" target="_blank" class="ml-auto text-sm underline text-brand-primary">Voir la médiathèque ↗</a>
</div>

{#if tab == "dashboard"}
  <MediaDashboard />
{:else if tab == "sermons"}
  <MediaCrud endpoint="/media/sermons" fields={sermonFields} newLabel="+ Nouveau sermon"
    itemSubtitle={(s) => `${formatDate(s.sermon_date)}${s.preacher ? " · " + s.preacher : ""}${s.series_name ? " · " + s.series_name : ""} · ${s.views_count} vue(s)`} />
{:else if tab == "series"}
  <MediaCrud endpoint="/media/series" fields={seriesFields} newLabel="+ Nouvelle série" publishable={false}
    itemTitle={(s) => s.name} itemSubtitle={(s) => `${s.is_active ? "Active" : "Inactive"} · ${s.sermons_count} sermon(s)`}
    on:change={loadSeries} />
{:else if tab == "gallery"}
  {#if openAlbum}
    <AlbumPhotos albumId={openAlbum} on:close={() => (openAlbum = null)} />
  {:else}
    <MediaCrud endpoint="/media/gallery" fields={albumFields} newLabel="+ Nouvel album"
      itemSubtitle={(a) => `${a.event_date ? formatDate(a.event_date) + " · " : ""}${a.photos_count} photo(s)`}>
      <svelte:fragment slot="actions" let:item>
        <button class="btn btn-secondary !py-1 !text-xs" on:click={() => (openAlbum = item.id)}>Photos</button>
      </svelte:fragment>
    </MediaCrud>
  {/if}
{:else if tab == "podcasts"}
  <MediaCrud endpoint="/media/podcasts" fields={podcastFields} newLabel="+ Nouvel épisode"
    itemSubtitle={(p) => `Saison ${p.season_number}${p.episode_number ? " · épisode " + p.episode_number : ""} · ${p.plays_count} écoute(s)`} />
{:else if tab == "press"}
  <MediaCrud endpoint="/media/press" fields={pressFields} newLabel="+ Nouveau communiqué"
    itemSubtitle={(p) => (p.published_at ? formatDate(p.published_at) : "Non publié") + (p.tags.length ? " · " + p.tags.join(", ") : "")} />
{:else if tab == "streams"}
  <MediaCrud endpoint="/media/streams" fields={streamFields} newLabel="+ Programmer un direct" publishable={false}
    itemSubtitle={(s) => `${s.is_live ? "🔴 EN DIRECT" : s.ended_at ? "Terminé" : "Programmé"} · ${typeLabel(s.type)}${s.scheduled_at ? " · " + formatDate(s.scheduled_at, true) : ""}`}>
    <svelte:fragment slot="actions" let:item let:reload>
      {#if item.is_live}
        <button class="btn btn-secondary !py-1 !text-xs" on:click={() => streamAction(item, "end", reload)}>Terminer le direct</button>
      {:else}
        <button class="btn btn-secondary !py-1 !text-xs" on:click={() => streamAction(item, "go-live", reload)}>Lancer le direct</button>
      {/if}
    </svelte:fragment>
  </MediaCrud>
{/if}
