<script>
  // Liste + formulaire d'un type de contenu média (charte M.A.N).
  // `fields` décrit le formulaire : { key, col, label, type, required, options, kind, help, placeholder }
  //   type : text | textarea | date | datetime | url | youtube | upload | select | number | checkbox | tags
  //          | scriptures | chapters | hidden
  //   upload : kind (image | audio | pdf), bytesKey / durationKey pour remplir la taille et la durée.
  import { onMount, createEventDispatcher } from "svelte";
  import api, { errorMessage } from "../../../utils/api";
  import { cdn } from "../../../utils/cdn.js";
  import Modal from "../../utils/Modal.svelte";
  import FormAlert from "../../auth/FormAlert.svelte";
  import { uploadMediaFile, audioDuration, toLocalInput, formatDate } from "./upload";
  import { clock, parseClock } from "../../../utils/media";

  export let endpoint; // ex. "/media/sermons"
  export let fields;
  export let noun = "élément"; // « message », « épisode »… pour les textes
  export let feminine = false;
  export let newLabel = "Ajouter";
  export let publishable = true;
  export let schedulable = false; // publication programmée
  export let itemTitle = (it) => it.title;
  export let itemSubtitle = () => "";
  export let itemImage = (it) => it.thumbnail_url || it.cover_image_url || it.cover;
  export let publicLink = null; // (it) => adresse sur le site
  export let emptyText = "";

  const dispatch = createEventDispatcher();
  const input = "man-input w-full h-[52px] rounded-2xl bg-white border-[1.5px] border-[#C9D6E8] px-4 text-man-nuit focus:border-man-marine focus:outline-none";

  let items = null;
  let listError = "";
  let notice = { text: "", kind: "success" };
  let editing = null; // { id?, values }
  let errors = {};
  let formError = "";
  let saving = false;
  let uploading = {}; // key → progression 0..1
  let yt = { busy: false, error: "", info: "" };
  let filter = "all";
  let search = "";
  let deleting = null;
  let publishing = null; // { item, mode: "now" | "later", at }

  export const load = async () => {
    listError = "";
    try {
      items = (await api.get(endpoint)).data;
    } catch (err) {
      items = items || [];
      listError = errorMessage(err, "La liste n'a pas pu être chargée.");
    }
  };

  const say = (text, kind = "success") => {
    notice = { text, kind };
    setTimeout(() => notice.text === text && (notice = { text: "", kind }), 4000);
  };

  const fromItem = (it) => {
    const v = {};
    for (const f of fields) {
      const raw = it ? it[f.col] : undefined;
      if (f.type === "checkbox") v[f.key] = it ? Boolean(raw) : f.default ?? false;
      else if (f.type === "datetime") v[f.key] = toLocalInput(raw);
      else if (f.type === "tags") v[f.key] = (raw || []).join(", ");
      else if (f.type === "chapters") v[f.key] = (raw || []).map((c) => ({ time: clock(c.t), label: c.label }));
      else if (f.type === "date" && raw) v[f.key] = String(raw).slice(0, 10);
      else if (raw === null || raw === undefined) v[f.key] = f.default ?? "";
      else v[f.key] = raw;
    }
    return v;
  };

  const toPayload = (v) => {
    const out = {};
    for (const f of fields) {
      const x = v[f.key];
      if (f.type === "checkbox") out[f.key] = Boolean(x);
      else if (f.type === "datetime") out[f.key] = x ? new Date(x).toISOString() : null;
      else if (f.type === "tags") out[f.key] = String(x || "").split(",").map((t) => t.trim()).filter(Boolean);
      else if (f.type === "number" || f.type === "hidden") out[f.key] = x === "" || x === null || x === undefined ? (f.required ? undefined : null) : Number(x);
      else if (f.type === "chapters") out[f.key] = x.filter((c) => c.label.trim() || c.time.trim()).map((c) => ({ t: parseClock(c.time), label: c.label.trim() }));
      else if (f.type === "select" && f.nullable) out[f.key] = x || null;
      else if (f.type === "date" || f.type === "url" || f.type === "youtube" || f.type === "upload") out[f.key] = String(x || "").trim() || null;
      else out[f.key] = typeof x === "string" ? x.trim() : x;
    }
    return out;
  };

  const startNew = () => {
    editing = { values: fromItem(null) };
    errors = {};
    formError = "";
    yt = { busy: false, error: "", info: "" };
  };
  const startEdit = (it) => {
    editing = { id: it.id, item: it, values: fromItem(it) };
    errors = {};
    formError = "";
    yt = { busy: false, error: "", info: "" };
  };

  function validateForm() {
    errors = {};
    for (const f of fields) {
      const v = editing.values[f.key];
      if (f.required && f.type !== "checkbox" && !String(v ?? "").trim()) errors[f.key] = `${f.label} : à remplir.`;
      if (f.type === "chapters") {
        const bad = v.findIndex((c) => (c.label.trim() || c.time.trim()) && (parseClock(c.time) === null || !c.label.trim()));
        if (bad >= 0) errors[f.key] = `Chapitre ${bad + 1} : indiquez un temps (ex. 12:30) et un titre.`;
      }
    }
    return !Object.keys(errors).length;
  }

  const save = async () => {
    formError = "";
    if (!validateForm()) return (formError = "Vérifiez les champs signalés.");
    saving = true;
    try {
      const body = toPayload(editing.values);
      if (editing.id) await api.put(`${endpoint}/${editing.id}`, body);
      else await api.post(endpoint, body);
      say(editing.id ? "Modifications enregistrées." : `${noun[0].toUpperCase()}${noun.slice(1)} enregistré${feminine ? "e" : ""}${publishable ? " en brouillon" : ""}.`);
      editing = null;
      await load();
      dispatch("change");
    } catch (err) {
      formError = errorMessage(err, "L'enregistrement a échoué.");
    } finally {
      saving = false;
    }
  };

  const act = async (it, action, body) => {
    try {
      if (action === "delete") await api.delete(`${endpoint}/${it.id}`);
      else await api.post(`${endpoint}/${it.id}/${action}`, body || {});
      await load();
      dispatch("change");
      if (action === "publish") say(body && body.publishAt ? `Publication programmée le ${formatDate(body.publishAt, true)}.` : "Publié sur le site.");
      else if (action === "unpublish") say("Retiré du site (brouillon).");
      else if (action === "delete") say("Supprimé.");
    } catch (err) {
      say(errorMessage(err), "error");
    }
  };

  const confirmPublish = async () => {
    const p = publishing;
    if (p.mode === "later") {
      if (!p.at || new Date(p.at) <= new Date()) return (p.error = "Choisissez une date à venir."), (publishing = p);
      publishing = null;
      return act(p.item, "publish", { publishAt: new Date(p.at).toISOString() });
    }
    publishing = null;
    act(p.item, "publish");
  };

  const onFile = async (f, files) => {
    if (!files || !files[0]) return;
    const file = files[0];
    uploading = { ...uploading, [f.key]: 0 };
    try {
      if (f.durationKey && f.kind === "audio" && !editing.values[f.durationKey]) {
        audioDuration(file).then((d) => d && editing && (editing.values[f.durationKey] = d));
      }
      const r = await uploadMediaFile(file, f.kind, (p) => (uploading = { ...uploading, [f.key]: p }));
      editing.values[f.key] = r.url;
      if (f.bytesKey) editing.values[f.bytesKey] = r.bytes;
    } catch (err) {
      errors = { ...errors, [f.key]: errorMessage(err, "L'envoi du fichier a échoué.") };
    } finally {
      const { [f.key]: _, ...rest } = uploading;
      uploading = rest;
    }
  };

  // Import YouTube : titre, description, date, durée, miniature.
  const importYouTube = async (f) => {
    const link = String(editing.values[f.key] || "").trim();
    if (!link) return (yt = { busy: false, error: "Collez d'abord le lien de la vidéo YouTube.", info: "" });
    yt = { busy: true, error: "", info: "" };
    try {
      const v = (await api.get("/media/youtube", { params: { url: link } })).data;
      const set = (key, val, force = false) => {
        if (val == null || val === "" || !fields.some((x) => x.key === key)) return;
        if (force || !String(editing.values[key] ?? "").trim()) editing.values[key] = val;
      };
      set(f.key, v.videoUrl, true);
      set("title", v.title);
      set("description", v.description);
      set("thumbnailUrl", v.thumbnailUrl);
      set("durationSeconds", v.durationSeconds);
      set("sermonDate", v.publishedAt ? String(v.publishedAt).slice(0, 10) : null);
      editing = editing;
      yt = {
        busy: false,
        error: "",
        info: v.source === "api"
          ? `Importé : « ${v.title} »${v.durationSeconds ? `, ${clock(v.durationSeconds)}` : ""}. Vérifiez et complétez.`
          : `Importé : « ${v.title} ». Sans clé YouTube, la date et la durée ne sont pas récupérées.`,
      };
    } catch (err) {
      yt = { busy: false, error: errorMessage(err, "La vidéo n'a pas pu être lue."), info: "" };
    }
  };

  const addChapter = (f) => {
    editing.values[f.key] = [...editing.values[f.key], { time: "", label: "" }];
  };
  const removeChapter = (f, i) => {
    editing.values[f.key] = editing.values[f.key].filter((_, j) => j !== i);
  };

  const status = (it) => {
    if (!publishable) return null;
    if (!it.is_published) return { t: "Brouillon", c: "bg-[#FFF4D6] text-[#7A5600]" };
    if (it.published_at && new Date(it.published_at) > new Date()) return { t: `Programmé · ${formatDate(it.published_at, true)}`, c: "bg-[#EAF3FB] text-man-marine" };
    return { t: "En ligne", c: "bg-[#E7F6EE] text-[#1E7A4C]" };
  };

  $: shown = (items || []).filter((it) => {
    if (search && !String(itemTitle(it)).toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "all" || !publishable) return true;
    const s = status(it).t;
    return filter === "draft" ? s === "Brouillon" : filter === "scheduled" ? s.startsWith("Programmé") : s === "En ligne";
  });
  $: busyUpload = Object.keys(uploading).length > 0;

  onMount(load);
</script>

<div class="mb-4"><FormAlert light message={notice.text || listError} kind={listError && !notice.text ? "error" : notice.kind} /></div>

{#if editing}
  <button type="button" class="font-bold text-man-marine hover:underline mb-4 min-h-[44px]" on:click={() => (editing = null)}>← Retour à la liste</button>
  <form on:submit|preventDefault={save} novalidate class="rounded-[22px] bg-white p-6 md:p-8 grid gap-5">
    <h2 class="font-slab font-bold text-[24px] text-man-nuit">{editing.id ? `Modifier : ${itemTitle(editing.item)}` : newLabel}</h2>
    <FormAlert light message={formError} />
    {#each fields as f (f.key)}
      {#if f.type === "hidden"}
        <!-- rempli automatiquement -->
      {:else if f.type === "checkbox"}
        <label class="flex items-start gap-3 min-h-[44px] cursor-pointer">
          <input type="checkbox" bind:checked={editing.values[f.key]} class="mt-0.5 w-5 h-5 accent-[#173E6F]" />
          <span><span class="block font-bold text-man-nuit">{f.label}</span>{#if f.help}<span class="block text-sm text-[#4A6285]">{f.help}</span>{/if}</span>
        </label>
      {:else}
        <div class="flex flex-col gap-2 min-w-0">
          <label class="text-sm font-bold text-man-nuit" for="mf-{f.key}">{f.label}{#if !f.required && f.type !== "chapters"}<span class="font-normal text-[#4A6285] ml-1">(facultatif)</span>{/if}</label>
          {#if f.type === "textarea"}
            <textarea id="mf-{f.key}" rows={f.rows || 6} bind:value={editing.values[f.key]} placeholder={f.placeholder || ""} class="man-input rounded-2xl bg-white border-[1.5px] border-[#C9D6E8] px-4 py-3 text-man-nuit focus:border-man-marine focus:outline-none"></textarea>
          {:else if f.type === "select"}
            <select id="mf-{f.key}" bind:value={editing.values[f.key]} class={input}>
              {#each f.options() as o}<option value={o.value}>{o.label}</option>{/each}
            </select>
          {:else if f.type === "date"}
            <input id="mf-{f.key}" type="date" bind:value={editing.values[f.key]} class={input} aria-invalid={errors[f.key] ? "true" : undefined} />
          {:else if f.type === "datetime"}
            <input id="mf-{f.key}" type="datetime-local" bind:value={editing.values[f.key]} class={input} />
          {:else if f.type === "number"}
            <input id="mf-{f.key}" type="number" min="1" inputmode="numeric" bind:value={editing.values[f.key]} class="{input} max-w-[10rem]" />
          {:else if f.type === "youtube"}
            <div class="flex flex-col sm:flex-row gap-2">
              <input id="mf-{f.key}" type="url" inputmode="url" bind:value={editing.values[f.key]} placeholder="https://www.youtube.com/watch?v=…" class={input} />
              <button type="button" class="btn-line !min-h-[52px] shrink-0" disabled={yt.busy} aria-busy={yt.busy} on:click={() => importYouTube(f)}>{yt.busy ? "Lecture…" : "Importer depuis YouTube"}</button>
            </div>
            <p class="text-sm {yt.error ? 'font-bold text-[#B3261E]' : yt.info ? 'text-[#1E7A4C] font-bold' : 'text-[#4A6285]'}" role="status" aria-live="polite">
              {yt.error || yt.info || "Les vidéos restent sur YouTube : le site les lit sans frais de stockage."}
            </p>
          {:else if f.type === "chapters"}
            <div class="grid gap-2">
              {#each editing.values[f.key] as c, i}
                <div class="flex gap-2 items-center">
                  <label class="sr-only" for="ch-t-{i}">Temps du chapitre {i + 1}</label>
                  <input id="ch-t-{i}" bind:value={c.time} placeholder="12:30" inputmode="numeric" maxlength="8" class="{input} !w-[6.5rem] tabular-nums" />
                  <label class="sr-only" for="ch-l-{i}">Titre du chapitre {i + 1}</label>
                  <input id="ch-l-{i}" bind:value={c.label} placeholder="Prédication" maxlength="120" class={input} />
                  <button type="button" class="shrink-0 min-h-[44px] px-3 font-bold text-[#B3261E] hover:underline" on:click={() => removeChapter(f, i)} aria-label="Retirer le chapitre {i + 1}">Retirer</button>
                </div>
              {/each}
              <button type="button" class="btn-line !min-h-[44px] justify-self-start" on:click={() => addChapter(f)}>Ajouter un chapitre</button>
            </div>
          {:else if f.type === "upload"}
            <div class="flex flex-col sm:flex-row gap-2">
              <input id="mf-{f.key}" type="url" placeholder="Lien, ou choisissez un fichier" bind:value={editing.values[f.key]} class={input} />
              <label class="relative btn-line !min-h-[52px] shrink-0 cursor-pointer {uploading[f.key] != null ? 'opacity-60 pointer-events-none' : ''}">
                {uploading[f.key] != null ? `Envoi ${Math.round(uploading[f.key] * 100)} %` : "Choisir un fichier"}
                <input type="file" class="sr-only" accept={f.kind === "image" ? "image/jpeg,image/png,image/webp" : f.kind === "audio" ? "audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/wav" : "application/pdf"}
                  on:change={(e) => onFile(f, e.currentTarget.files)} />
              </label>
            </div>
            {#if uploading[f.key] != null}
              <div class="h-2 rounded-full bg-[#EEF2F8] overflow-hidden" role="progressbar" aria-label="Envoi du fichier" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(uploading[f.key] * 100)}>
                <div class="h-full bg-man-marine transition-[width] duration-200" style="width:{Math.round(uploading[f.key] * 100)}%"></div>
              </div>
            {/if}
            {#if f.kind === "image" && editing.values[f.key]}<img src={cdn(editing.values[f.key], 240)} alt="Aperçu" class="h-24 w-40 rounded-xl object-cover" />{/if}
            <!-- svelte-ignore a11y-media-has-caption -->
            {#if f.kind === "audio" && editing.values[f.key]}<audio controls preload="none" src={editing.values[f.key]} class="w-full"></audio>{/if}
          {:else if f.type === "url"}
            <input id="mf-{f.key}" type="url" inputmode="url" bind:value={editing.values[f.key]} placeholder={f.placeholder || ""} class={input} />
          {:else}
            <input id="mf-{f.key}" type="text" bind:value={editing.values[f.key]} placeholder={f.placeholder || ""} class={input} aria-invalid={errors[f.key] ? "true" : undefined} />
          {/if}
          {#if errors[f.key]}<p class="text-sm font-bold text-[#B3261E]">{errors[f.key]}</p>
          {:else if f.help && f.type !== "youtube"}<p class="text-sm text-[#4A6285]">{f.help}</p>{/if}
        </div>
      {/if}
    {/each}
    <div class="flex flex-col sm:flex-row gap-3 pt-2">
      <button type="submit" class="btn-or sm:min-w-[14rem]" disabled={saving || busyUpload} aria-busy={saving}>
        {saving ? "Enregistrement…" : busyUpload ? "Envoi du fichier en cours…" : "Enregistrer"}
      </button>
      <button type="button" class="btn-line" on:click={() => (editing = null)}>Annuler</button>
    </div>
    {#if publishable && !editing.id}<p class="text-sm text-[#4A6285]">Enregistré en brouillon : publiez-le ensuite depuis la liste, tout de suite ou à une date choisie.</p>{/if}
  </form>
{:else}
  <div class="flex flex-wrap items-center gap-3 mb-5">
    <button type="button" class="btn-or !min-h-[44px]" on:click={startNew}>{newLabel}</button>
    {#if items && items.length > 5}
      <label class="sr-only" for="mc-search">Rechercher</label>
      <input id="mc-search" type="search" bind:value={search} placeholder="Rechercher…" class="man-input h-[44px] rounded-full bg-white border-[1.5px] border-[#C9D6E8] px-4 text-man-nuit min-w-0 flex-1 sm:flex-none sm:w-64" />
    {/if}
    {#if publishable && items && items.length}
      <div class="flex flex-wrap gap-1 rounded-full bg-white p-1" role="group" aria-label="Filtrer">
        {#each [["all", "Tous"], ["online", "En ligne"], ["scheduled", "Programmés"], ["draft", "Brouillons"]] as [v, l]}
          <button type="button" aria-pressed={filter === v} class="min-h-[36px] px-3 rounded-full text-[14px] font-bold transition-colors duration-150 {filter === v ? 'bg-man-nuit text-white' : 'text-[#2B3F5C] hover:bg-[#EEF2F8]'}" on:click={() => (filter = v)}>{l}</button>
        {/each}
      </div>
    {/if}
  </div>

  {#if items == null}
    <div class="grid gap-3" aria-busy="true" aria-label="Chargement">{#each [0, 1, 2] as _}<div class="h-[88px] rounded-2xl bg-white animate-pulse"></div>{/each}</div>
  {:else if !items.length}
    <div class="rounded-2xl bg-white p-8 flex flex-col items-start gap-3">
      <p class="font-slab font-bold text-[22px] text-man-nuit">Rien pour l'instant</p>
      {#if emptyText}<p class="text-[#2B3F5C]">{emptyText}</p>{/if}
      <button type="button" class="btn-or !min-h-[44px] mt-1" on:click={startNew}>{newLabel}</button>
    </div>
  {:else}
    <ul class="grid gap-3">
      {#each shown as it (it.id)}
        {@const st = status(it)}
        <li class="rounded-2xl bg-white p-4 flex flex-col md:flex-row md:items-center gap-4">
          <div class="flex items-center gap-4 flex-1 min-w-0">
            {#if itemImage(it)}<img src={cdn(itemImage(it), 160)} alt="" class="w-24 h-14 shrink-0 rounded-xl object-cover" loading="lazy" />{/if}
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-bold text-man-nuit text-[17px]">{itemTitle(it)}</span>
                {#if st}<span class="rounded-full px-2.5 py-0.5 text-[13px] font-bold {st.c}">{st.t}</span>{/if}
              </div>
              <div class="text-[15px] text-[#4A6285] truncate">{itemSubtitle(it)}</div>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <slot name="actions" item={it} reload={load} />
            <button type="button" class="btn-line !min-h-[40px] !text-[14px]" on:click={() => startEdit(it)}>Modifier</button>
            {#if publishable}
              {#if it.is_published}
                <button type="button" class="btn-line !min-h-[40px] !text-[14px]" on:click={() => act(it, "unpublish")}>Retirer du site</button>
              {:else}
                <button type="button" class="btn-or !min-h-[40px] !text-[14px]" on:click={() => (schedulable ? (publishing = { item: it, mode: "now", at: "" }) : act(it, "publish"))}>Publier</button>
              {/if}
            {/if}
            {#if publicLink && it.is_published && st && st.t === "En ligne"}<a class="btn-line !min-h-[40px] !text-[14px]" href={publicLink(it)} target="_blank" rel="noopener">Voir sur le site</a>{/if}
            <button type="button" class="min-h-[40px] px-3 text-[14px] font-bold text-[#B3261E] hover:underline" on:click={() => (deleting = it)}>Supprimer</button>
          </div>
        </li>
      {:else}
        <li class="rounded-2xl bg-white p-5 text-[#2B3F5C]">Aucun résultat pour ce filtre.</li>
      {/each}
    </ul>
  {/if}
{/if}

<Modal show={Boolean(publishing)} title="Publier" on:modalClose={() => (publishing = null)}>
  {#if publishing}
    <p class="text-[#2B3F5C] mb-4"><strong class="text-man-nuit">{itemTitle(publishing.item)}</strong></p>
    <fieldset class="grid gap-3">
      <legend class="sr-only">Quand publier ?</legend>
      {#each [["now", "Maintenant", "Visible tout de suite sur le site."], ["later", "Programmer", "Visible automatiquement à la date choisie."]] as [v, t, d]}
        <label class="flex gap-3 items-start rounded-2xl border-[1.5px] p-4 cursor-pointer transition-colors duration-150 {publishing.mode === v ? 'border-man-marine bg-[#EAF3FB]' : 'border-[#E1E8F1]'}">
          <input type="radio" name="pub-mode" value={v} bind:group={publishing.mode} class="mt-1 w-5 h-5 accent-[#173E6F]" />
          <span><span class="block font-bold text-man-nuit">{t}</span><span class="block text-[15px] text-[#4A6285]">{d}</span></span>
        </label>
      {/each}
    </fieldset>
    {#if publishing.mode === "later"}
      <div class="mt-4 flex flex-col gap-2">
        <label for="pub-at" class="text-sm font-bold text-man-nuit">Date et heure de publication</label>
        <input id="pub-at" type="datetime-local" bind:value={publishing.at} class={input} />
        {#if publishing.error}<p class="text-sm font-bold text-[#B3261E]">{publishing.error}</p>{:else}<p class="text-sm text-[#4A6285]">Heure de Lubumbashi.</p>{/if}
      </div>
    {/if}
    <button type="button" class="btn-or w-full mt-5" on:click={confirmPublish}>{publishing.mode === "later" ? "Programmer la publication" : "Publier maintenant"}</button>
  {/if}
</Modal>

<Modal show={Boolean(deleting)} title="Supprimer ?" on:modalClose={() => (deleting = null)}>
  {#if deleting}
    <p class="text-[#2B3F5C]"><strong class="text-man-nuit">{itemTitle(deleting)}</strong> sera supprimé{feminine ? "e" : ""} du site et de la médiathèque.</p>
    <p class="mt-2 font-bold text-[#B3261E]">Cette action est irréversible.</p>
    <button type="button" class="btn-or w-full mt-5 !bg-[#B3261E] !text-white" on:click={() => { const it = deleting; deleting = null; act(it, "delete"); }}>Supprimer définitivement</button>
  {/if}
</Modal>
