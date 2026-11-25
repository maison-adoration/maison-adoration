<script>
  // Espace de l'équipe média (rôles media, admin, super-admin).
  import api from "../../../utils/api";
  import MediaCrud from "./MediaCrud.svelte";
  import AlbumPhotos from "./AlbumPhotos.svelte";
  import MediaDashboard from "./MediaDashboard.svelte";
  import LiveControl from "./LiveControl.svelte";
  import MediaTools from "./MediaTools.svelte";
  import FormAlert from "../../auth/FormAlert.svelte";
  import { formatDate } from "./upload";
  import { clock, messagePath } from "../../../utils/media";
  import { errorMessage } from "../../../utils/api";

  const TABS = [
    ["dashboard", "Accueil"],
    ["sermons", "Messages"],
    ["series", "Séries"],
    ["streams", "Directs"],
    ["gallery", "Galerie"],
    ["podcasts", "Podcasts"],
    ["press", "Communiqués"],
    ["tools", "Équipement"],
  ];
  let tab = "dashboard";
  let openAlbum = null;
  let regie = null;
  let notice = "";

  const go = (t, extra = {}) => {
    tab = t;
    openAlbum = null;
    regie = extra.streamId || null;
  };

  let seriesOptions = [{ value: "", label: "Aucune série" }];
  const loadSeries = async () => {
    try {
      const res = await api.get("/media/series");
      seriesOptions = [{ value: "", label: "Aucune série" }, ...res.data.map((s) => ({ value: s.id, label: s.name }))];
    } catch {
      /* liste vide */
    }
  };
  loadSeries();

  let eventOptions = [{ value: "", label: "Aucun événement" }];
  api.get("/media/events-options")
    .then((r) => (eventOptions = [{ value: "", label: "Aucun événement" }, ...r.data.map((e) => ({ value: e.id, label: `${e.title} (${formatDate(e.starts_at)})` }))]))
    .catch(() => {});

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
    { key: "videoUrl", col: "video_url", label: "Vidéo YouTube", type: "youtube" },
    { key: "title", col: "title", label: "Titre", required: true },
    { key: "preacher", col: "preacher", label: "Prédicateur", placeholder: "Prophète Israel Kayembe" },
    { key: "sermonDate", col: "sermon_date", label: "Date du message", type: "date", required: true },
    { key: "seriesId", col: "series_id", label: "Série", type: "select", nullable: true, options: () => seriesOptions },
    { key: "scriptures", col: "scriptures", label: "Passages bibliques", placeholder: "Jean 3:16-18 ; Romains 8", help: "Séparez les passages par « ; ». Ils servent au filtre « livre de la Bible »." },
    { key: "chapters", col: "chapters", label: "Chapitres", type: "chapters", help: "" },
    { key: "audioUrl", col: "audio_url", label: "Audio (MP3)", type: "upload", kind: "audio", bytesKey: "audioBytes", durationKey: "durationSeconds", help: "Pour l'écoute seule et le téléchargement : bien plus léger que la vidéo." },
    { key: "pdfUrl", col: "pdf_url", label: "Notes (PDF)", type: "upload", kind: "pdf" },
    { key: "thumbnailUrl", col: "thumbnail_url", label: "Miniature", type: "upload", kind: "image", help: "Vide : la miniature YouTube est utilisée." },
    { key: "description", col: "description", label: "Description", type: "textarea", rows: 5 },
    { key: "isFeatured", col: "is_featured", label: "Mettre à la une", type: "checkbox", help: "Affiché en premier dans la médiathèque." },
    { key: "durationSeconds", col: "duration_seconds", type: "hidden" },
    { key: "audioBytes", col: "audio_bytes", type: "hidden" },
  ];
  const seriesFields = [
    { key: "name", col: "name", label: "Nom de la série", required: true },
    { key: "description", col: "description", label: "Description", type: "textarea", rows: 4 },
    { key: "coverImageUrl", col: "cover_image_url", label: "Image de couverture", type: "upload", kind: "image" },
    { key: "isActive", col: "is_active", label: "Série active", type: "checkbox", default: true, help: "Visible dans les filtres de la médiathèque." },
  ];
  const albumFields = [
    { key: "title", col: "title", label: "Titre de l'album", required: true },
    { key: "eventId", col: "event_id", label: "Événement lié", type: "select", nullable: true, options: () => eventOptions },
    { key: "eventDate", col: "event_date", label: "Date", type: "date" },
    { key: "description", col: "description", label: "Description", type: "textarea", rows: 3 },
    { key: "coverImageUrl", col: "cover_image_url", label: "Couverture", type: "upload", kind: "image", help: "Vide : la première photo sert de couverture." },
  ];
  const podcastFields = [
    { key: "title", col: "title", label: "Titre de l'épisode", required: true },
    { key: "audioUrl", col: "audio_url", label: "Fichier audio (MP3)", type: "upload", kind: "audio", required: true, bytesKey: "audioBytes", durationKey: "durationSeconds" },
    { key: "seasonNumber", col: "season_number", label: "Saison", type: "number", required: true, default: 1 },
    { key: "episodeNumber", col: "episode_number", label: "Numéro d'épisode", type: "number" },
    { key: "thumbnailUrl", col: "thumbnail_url", label: "Image", type: "upload", kind: "image" },
    { key: "description", col: "description", label: "Description", type: "textarea" },
    { key: "durationSeconds", col: "duration_seconds", type: "hidden" },
    { key: "audioBytes", col: "audio_bytes", type: "hidden" },
  ];
  const pressFields = [
    { key: "title", col: "title", label: "Titre", required: true },
    { key: "excerpt", col: "excerpt", label: "Résumé (affiché dans la liste)", type: "textarea", rows: 2 },
    { key: "content", col: "content", label: "Texte du communiqué", type: "textarea", rows: 12, required: true },
    { key: "coverImageUrl", col: "cover_image_url", label: "Image", type: "upload", kind: "image" },
    { key: "tags", col: "tags", label: "Mots-clés", type: "tags", help: "Séparés par des virgules." },
  ];
  const streamFields = [
    { key: "title", col: "title", label: "Titre", required: true },
    { key: "type", col: "type", label: "Type", type: "select", options: () => STREAM_TYPES, default: "culte" },
    { key: "platform", col: "platform", label: "Plateforme", type: "select", options: () => PLATFORMS, default: "youtube" },
    { key: "streamUrl", col: "stream_url", label: "Lien du direct", type: "url", help: "Le lien YouTube du direct programmé. Obligatoire pour lancer le direct." },
    { key: "scheduledAt", col: "scheduled_at", label: "Date et heure prévues", type: "datetime" },
    { key: "chatEnabled", col: "chat_enabled", label: "Discussion pendant le direct", type: "checkbox", default: true, help: "Modérée depuis la régie." },
    { key: "prayerEnabled", col: "prayer_enabled", label: "Bouton « Demander la prière »", type: "checkbox", default: true, help: "Les demandes arrivent à l'équipe de prière." },
    { key: "thumbnailUrl", col: "thumbnail_url", label: "Image", type: "upload", kind: "image" },
    { key: "description", col: "description", label: "Description", type: "textarea", rows: 3 },
    { key: "recordingUrl", col: "recording_url", label: "Lien de la rediffusion", type: "url", help: "Rempli automatiquement si le direct est archivé." },
  ];

  const sermonSub = (s) =>
    [formatDate(s.sermon_date), s.preacher, s.series_name, s.duration_seconds && clock(s.duration_seconds), s.audio_url ? "audio" : null, `${s.views_count} vue${s.views_count > 1 ? "s" : ""}`]
      .filter(Boolean)
      .join(" · ");
  const streamStatus = (s) => (s.is_live ? "En direct" : s.ended_at ? "Terminé" : "Programmé");

  const goLive = async (s, reload) => {
    notice = "";
    try {
      await api.post(`/media/streams/${s.id}/go-live`);
      await reload();
      regie = s.id;
    } catch (err) {
      notice = errorMessage(err, "Le direct n'a pas pu être lancé.");
    }
  };
  let ended = "";
  const onEnded = (e) => {
    regie = null;
    ended = e.detail.archived
      ? `Direct terminé. Le message « ${e.detail.archived.title} » est ${e.detail.archived.is_published ? "en ligne" : "en brouillon"} dans Messages.`
      : "Direct terminé.";
  };
</script>

<nav class="flex flex-wrap gap-1 rounded-[22px] bg-white p-1.5 mb-6" aria-label="Rubriques de la médiathèque">
  {#each TABS as [id, label]}
    <button type="button" aria-current={tab == id ? "page" : undefined}
      class="min-h-[44px] px-4 rounded-full font-bold text-[15px] transition-colors duration-150 {tab == id ? 'bg-man-nuit text-white' : 'text-[#2B3F5C] hover:bg-[#EEF2F8]'}"
      on:click={() => go(id)}>{label}</button>
  {/each}
  <a href="/mediatheque" target="_blank" rel="noopener" class="ml-auto inline-flex items-center min-h-[44px] px-4 font-bold text-man-marine hover:underline">Voir la médiathèque</a>
</nav>

{#if tab == "dashboard"}
  <MediaDashboard on:open={(e) => go(e.detail.tab, e.detail)} />
{:else if tab == "sermons"}
  <MediaCrud endpoint="/media/sermons" fields={sermonFields} noun="message" newLabel="Nouveau message" schedulable
    itemSubtitle={sermonSub} publicLink={messagePath}
    emptyText="Collez le lien d'une vidéo YouTube : titre, description et miniature se remplissent tout seuls." />
{:else if tab == "series"}
  <MediaCrud endpoint="/media/series" fields={seriesFields} noun="série" feminine newLabel="Nouvelle série" publishable={false}
    itemTitle={(s) => s.name} itemSubtitle={(s) => `${s.is_active ? "Active" : "Inactive"} · ${s.sermons_count} message${s.sermons_count > 1 ? "s" : ""}`}
    on:change={loadSeries} />
{:else if tab == "streams"}
  {#if regie}
    <LiveControl streamId={regie} {seriesOptions} on:close={() => (regie = null)} on:ended={onEnded} />
  {:else}
    {#if notice || ended}<div class="mb-4"><FormAlert light message={notice || ended} kind={notice ? "error" : "success"} /></div>{/if}
    <MediaCrud endpoint="/media/streams" fields={streamFields} noun="direct" newLabel="Programmer un direct" publishable={false}
      itemSubtitle={(s) => [streamStatus(s), typeLabel(s.type), s.scheduled_at && formatDate(s.scheduled_at, true)].filter(Boolean).join(" · ")}
      emptyText="Programmez le prochain culte : le lien YouTube du direct suffit.">
      <svelte:fragment slot="actions" let:item let:reload>
        {#if item.is_live}
          <button type="button" class="btn-or !min-h-[40px] !text-[14px]" on:click={() => (regie = item.id)}>Ouvrir la régie</button>
        {:else if !item.ended_at}
          <button type="button" class="btn-or !min-h-[40px] !text-[14px]" disabled={!item.stream_url} title={item.stream_url ? undefined : "Ajoutez d'abord le lien du direct"} on:click={() => goLive(item, reload)}>Lancer le direct</button>
        {:else}
          <button type="button" class="btn-line !min-h-[40px] !text-[14px]" on:click={() => (regie = item.id)}>Revoir la discussion</button>
        {/if}
      </svelte:fragment>
    </MediaCrud>
  {/if}
{:else if tab == "gallery"}
  {#if openAlbum}
    <AlbumPhotos albumId={openAlbum} on:close={() => (openAlbum = null)} />
  {:else}
    <MediaCrud endpoint="/media/gallery" fields={albumFields} noun="album" newLabel="Nouvel album" schedulable
      itemSubtitle={(a) => [a.event_title, a.event_date && formatDate(a.event_date), `${a.photos_count} photo${a.photos_count > 1 ? "s" : ""}`].filter(Boolean).join(" · ")}
      publicLink={(a) => `/mediatheque?album=${a.id}`}
      emptyText="Créez un album, puis glissez-y les photos du culte ou de l'événement.">
      <svelte:fragment slot="actions" let:item>
        <button type="button" class="btn-or !min-h-[40px] !text-[14px]" on:click={() => (openAlbum = item.id)}>Photos ({item.photos_count})</button>
      </svelte:fragment>
    </MediaCrud>
  {/if}
{:else if tab == "podcasts"}
  <MediaCrud endpoint="/media/podcasts" fields={podcastFields} noun="épisode" newLabel="Nouvel épisode" schedulable
    itemSubtitle={(p) => [`Saison ${p.season_number}`, p.episode_number && `épisode ${p.episode_number}`, p.duration_seconds && clock(p.duration_seconds), `${p.plays_count} écoute${p.plays_count > 1 ? "s" : ""}`].filter(Boolean).join(" · ")} />
{:else if tab == "press"}
  <MediaCrud endpoint="/media/press" fields={pressFields} noun="communiqué" newLabel="Nouveau communiqué" schedulable
    itemSubtitle={(p) => [p.published_at && formatDate(p.published_at), p.tags.length && p.tags.join(", ")].filter(Boolean).join(" · ")} />
{:else if tab == "tools"}
  <MediaTools />
{/if}
