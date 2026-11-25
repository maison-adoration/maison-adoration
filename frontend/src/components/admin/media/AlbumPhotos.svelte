<script>
  // Photos d'un album : glisser-déposer de plusieurs photos (envoi 3 par 3,
  // progression par fichier), légendes modifiables sur place, suppression.
  import { onMount, createEventDispatcher } from "svelte";
  import api, { errorMessage } from "../../../utils/api";
  import { cdn } from "../../../utils/cdn.js";
  import Modal from "../../utils/Modal.svelte";
  import FormAlert from "../../auth/FormAlert.svelte";
  import { uploadMediaFile } from "./upload";

  export let albumId;
  const dispatch = createEventDispatcher();

  const TYPES = ["image/jpeg", "image/png", "image/webp"];
  const MAX = 15 * 1024 * 1024;

  let album = null;
  let queue = []; // { id, name, preview, progress, state: waiting|sending|done|error, error, url }
  let dragging = false;
  let notice = { text: "", kind: "success" };
  let removing = null;
  let captions = {};

  const load = async () => {
    try {
      album = (await api.get(`/media/gallery/${albumId}`)).data;
      captions = Object.fromEntries(album.photos.map((p) => [p.id, p.caption || ""]));
    } catch (err) {
      notice = { text: errorMessage(err), kind: "error" };
    }
  };

  $: sending = queue.some((q) => q.state === "waiting" || q.state === "sending");
  $: doneCount = queue.filter((q) => q.state === "done").length;

  function addFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const rejected = files.filter((f) => !TYPES.includes(f.type) || f.size > MAX);
    const ok = files.filter((f) => !rejected.includes(f));
    notice = rejected.length
      ? { text: `${rejected.length} fichier${rejected.length > 1 ? "s ignorés" : " ignoré"} : formats JPG, PNG ou WebP, 15 Mo maximum.`, kind: "error" }
      : { text: "", kind: "success" };
    const items = ok.map((f) => ({ id: Math.random().toString(36).slice(2), file: f, name: f.name, preview: URL.createObjectURL(f), progress: 0, state: "waiting" }));
    queue = [...queue, ...items];
    run();
  }

  let running = false;
  async function run() {
    if (running) return;
    running = true;
    const worker = async () => {
      for (;;) {
        const item = queue.find((q) => q.state === "waiting");
        if (!item) return;
        item.state = "sending";
        queue = queue;
        try {
          const r = await uploadMediaFile(item.file, "image", (p) => ((item.progress = p), (queue = queue)));
          item.url = r.url;
          item.state = "done";
        } catch (err) {
          item.state = "error";
          item.error = errorMessage(err, "Échec de l'envoi");
        }
        queue = queue;
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    // Toutes les photos envoyées sont ajoutées à l'album en une fois, dans l'ordre choisi.
    const urls = queue.filter((q) => q.state === "done" && !q.saved).map((q) => q);
    if (urls.length) {
      try {
        await api.post(`/media/gallery/${albumId}/photos`, { photos: urls.map((q) => ({ url: q.url })) });
        urls.forEach((q) => (q.saved = true));
        notice = { text: `${urls.length} photo${urls.length > 1 ? "s ajoutées" : " ajoutée"} à l'album.`, kind: "success" };
        await load();
        dispatch("change");
      } catch (err) {
        notice = { text: errorMessage(err, "Les photos sont envoyées mais n'ont pas pu être ajoutées à l'album. Réessayez."), kind: "error" };
      }
    }
    queue.filter((q) => q.saved).forEach((q) => URL.revokeObjectURL(q.preview));
    queue = queue.filter((q) => !q.saved);
    running = false;
    if (queue.some((q) => q.state === "waiting")) run();
  }

  const retry = (item) => {
    item.state = "waiting";
    item.error = "";
    item.progress = 0;
    queue = queue;
    run();
  };
  const drop = (item) => {
    URL.revokeObjectURL(item.preview);
    queue = queue.filter((q) => q !== item);
  };

  const saveCaption = async (p) => {
    const c = (captions[p.id] || "").trim();
    if (c === (p.caption || "")) return;
    try {
      await api.put(`/media/photos/${p.id}`, { caption: c });
      p.caption = c;
      notice = { text: "Légende enregistrée.", kind: "success" };
    } catch (err) {
      notice = { text: errorMessage(err), kind: "error" };
    }
  };

  const remove = async () => {
    const p = removing;
    removing = null;
    try {
      await api.delete(`/media/photos/${p.id}`);
      await load();
      dispatch("change");
    } catch (err) {
      notice = { text: errorMessage(err), kind: "error" };
    }
  };

  const onDrop = (e) => {
    dragging = false;
    addFiles(e.dataTransfer && e.dataTransfer.files);
  };

  onMount(load);
</script>

<button type="button" class="font-bold text-man-marine hover:underline mb-4 min-h-[44px]" on:click={() => dispatch("close")}>← Tous les albums</button>

<div class="rounded-[22px] bg-white p-6 md:p-8">
  <div class="flex flex-wrap items-baseline justify-between gap-3">
    <h2 class="font-slab font-bold text-[26px] text-man-nuit">{album ? album.title : "Album"}</h2>
    {#if album}<p class="text-[#4A6285]">{album.photos.length} photo{album.photos.length > 1 ? "s" : ""}{album.event_title ? ` · ${album.event_title}` : ""}</p>{/if}
  </div>

  <div class="mt-4"><FormAlert light message={notice.text} kind={notice.kind} /></div>

  <label
    class="relative mt-4 flex flex-col items-center justify-center gap-2 rounded-[22px] border-2 border-dashed p-8 text-center cursor-pointer transition-colors duration-150 {dragging ? 'border-man-marine bg-[#EAF3FB]' : 'border-[#C9D6E8] hover:border-man-marine'}"
    on:dragenter|preventDefault={() => (dragging = true)}
    on:dragover|preventDefault={() => (dragging = true)}
    on:dragleave|preventDefault={() => (dragging = false)}
    on:drop|preventDefault={onDrop}
  >
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#173E6F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 16l4.5-4.5a2 2 0 012.8 0L16 16m-2-2l1.5-1.5a2 2 0 012.8 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
    <span class="font-bold text-man-nuit text-[17px]">Glissez les photos ici</span>
    <span class="text-[#4A6285]">ou <span class="font-bold text-man-marine underline">choisissez-les</span> · JPG, PNG ou WebP, plusieurs à la fois</span>
    <input type="file" accept={TYPES.join(",")} multiple class="sr-only" on:change={(e) => { addFiles(e.currentTarget.files); e.currentTarget.value = ""; }} />
  </label>

  {#if queue.length}
    <div class="mt-5" aria-live="polite">
      <p class="font-bold text-man-nuit mb-3">{sending ? `Envoi en cours : ${doneCount} / ${queue.length}` : "Envoi terminé"}</p>
      <ul class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {#each queue as q (q.id)}
          <li class="rounded-xl overflow-hidden border border-[#E1E8F1]">
            <img src={q.preview} alt="" class="w-full h-24 object-cover {q.state === 'done' ? '' : 'opacity-60'}" />
            <div class="p-2">
              <div class="text-[12px] text-[#4A6285] truncate" title={q.name}>{q.name}</div>
              {#if q.state === "error"}
                <p class="text-[12px] font-bold text-[#B3261E]">{q.error}</p>
                <div class="flex gap-2 mt-1">
                  <button type="button" class="text-[13px] font-bold text-man-marine underline min-h-[32px]" on:click={() => retry(q)}>Réessayer</button>
                  <button type="button" class="text-[13px] font-bold text-[#B3261E] underline min-h-[32px]" on:click={() => drop(q)}>Retirer</button>
                </div>
              {:else}
                <div class="mt-1 h-1.5 rounded-full bg-[#EEF2F8] overflow-hidden" role="progressbar" aria-label="Envoi de {q.name}" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round((q.state === 'done' ? 1 : q.progress) * 100)}>
                  <div class="h-full {q.state === 'done' ? 'bg-[#1E7A4C]' : 'bg-man-marine'} transition-[width] duration-200" style="width:{Math.round((q.state === 'done' ? 1 : q.progress) * 100)}%"></div>
                </div>
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  {#if album == null}
    <div class="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3" aria-busy="true" aria-label="Chargement">{#each [0, 1, 2, 3] as _}<div class="h-40 rounded-xl bg-[#EEF2F8] animate-pulse"></div>{/each}</div>
  {:else if album.photos.length}
    <ul class="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {#each album.photos as p, i (p.id)}
        <li class="rounded-xl overflow-hidden border border-[#E1E8F1]">
          <img src={cdn(p.url, 320)} alt={p.caption || `Photo ${i + 1}`} class="w-full h-36 object-cover" loading="lazy" />
          <div class="p-2 grid gap-1">
            <label class="sr-only" for="cap-{p.id}">Légende de la photo {i + 1}</label>
            <input id="cap-{p.id}" bind:value={captions[p.id]} on:blur={() => saveCaption(p)} on:keydown={(e) => e.key === "Enter" && (e.preventDefault(), e.currentTarget.blur())}
              placeholder="Ajouter une légende" maxlength="300" class="man-input h-[40px] rounded-lg border-[1.5px] border-[#E1E8F1] px-2 text-[14px] text-man-nuit focus:border-man-marine focus:outline-none" />
            <button type="button" class="justify-self-start min-h-[36px] text-[13px] font-bold text-[#B3261E] hover:underline" on:click={() => (removing = p)}>Supprimer</button>
          </div>
        </li>
      {/each}
    </ul>
  {:else if !queue.length}
    <p class="mt-6 text-[#2B3F5C]">Aucune photo pour l'instant. Glissez-les dans la zone ci-dessus.</p>
  {/if}
</div>

<Modal show={Boolean(removing)} title="Supprimer cette photo ?" on:modalClose={() => (removing = null)}>
  {#if removing}
    <img src={cdn(removing.url, 400)} alt="" class="w-full h-40 object-cover rounded-xl" />
    <p class="mt-3 font-bold text-[#B3261E]">Elle disparaîtra de l'album sur le site.</p>
    <button type="button" class="btn-or w-full mt-5 !bg-[#B3261E] !text-white" on:click={remove}>Supprimer la photo</button>
  {/if}
</Modal>
