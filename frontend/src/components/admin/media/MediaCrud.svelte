<script>
  import { cdn } from "../../../utils/cdn.js";
  // Liste + formulaire générique pour un type de contenu média.
  // `fields` décrit le formulaire : { key, col, label, type, required, options, kind, help }
  //   type : text | textarea | date | datetime | url | upload | select | number | checkbox | tags
  import { onMount, createEventDispatcher } from "svelte";
  import api, { errorMessage } from "../../../utils/api";
  import Loading from "../../utils/Loading.svelte";
  import Empty from "../../utils/Empty.svelte";
  import { uploadMediaFile, toLocalInput } from "./upload";

  export let endpoint; // ex. "/media/sermons"
  export let fields;
  export let newLabel = "+ Ajouter";
  export let publishable = true;
  export let itemTitle = (it) => it.title;
  export let itemSubtitle = () => "";
  export let itemImage = (it) => it.thumbnail_url || it.cover_image_url || it.cover;
  export let reloadKey = 0; // incrémenter pour forcer un rechargement

  const dispatch = createEventDispatcher();

  let items = null;
  let editing = null; // { id?, values }
  let saving = false;
  let uploading = {};

  export const load = async () => {
    try {
      const res = await api.get(endpoint);
      items = res.data;
    } catch (err) {
      items = [];
      alert(errorMessage(err));
    }
  };

  let lastKey = reloadKey;
  $: if (reloadKey !== lastKey) {
    lastKey = reloadKey;
    load();
  }

  const fromItem = (it) => {
    const v = {};
    for (const f of fields) {
      const raw = it ? it[f.col] : undefined;
      if (f.type === "checkbox") v[f.key] = it ? Boolean(raw) : Boolean(f.default);
      else if (f.type === "datetime") v[f.key] = toLocalInput(raw);
      else if (f.type === "tags") v[f.key] = (raw || []).join(", ");
      else if (raw === null || raw === undefined) v[f.key] = f.default ?? "";
      else v[f.key] = raw;
    }
    return v;
  };

  const toPayload = (v) => {
    const out = {};
    for (const f of fields) {
      let x = v[f.key];
      if (f.type === "checkbox") out[f.key] = Boolean(x);
      else if (f.type === "datetime") out[f.key] = x ? new Date(x).toISOString() : null;
      else if (f.type === "tags") out[f.key] = String(x || "").split(",").map((t) => t.trim()).filter(Boolean);
      else if (f.type === "number") out[f.key] = x === "" || x === null ? (f.required ? undefined : null) : Number(x);
      else if (f.type === "select" && f.nullable) out[f.key] = x || null;
      else out[f.key] = typeof x === "string" ? x.trim() : x;
    }
    return out;
  };

  const startNew = () => (editing = { values: fromItem(null) });
  const startEdit = (it) => (editing = { id: it.id, values: fromItem(it) });

  const save = async () => {
    for (const f of fields) {
      if (f.required && !String(editing.values[f.key] ?? "").trim()) return alert(`Le champ « ${f.label} » est obligatoire.`);
    }
    saving = true;
    try {
      const body = toPayload(editing.values);
      if (editing.id) await api.put(`${endpoint}/${editing.id}`, body);
      else await api.post(endpoint, body);
      editing = null;
      await load();
      dispatch("change");
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      saving = false;
    }
  };

  const act = async (it, action, confirmText) => {
    if (confirmText && !confirm(confirmText)) return;
    try {
      if (action === "delete") await api.delete(`${endpoint}/${it.id}`);
      else await api.post(`${endpoint}/${it.id}/${action}`);
      await load();
      dispatch("change");
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const onFile = async (f, files) => {
    if (!files || !files[0]) return;
    uploading = { ...uploading, [f.key]: true };
    try {
      editing.values[f.key] = await uploadMediaFile(files[0], f.kind);
    } catch (err) {
      alert(errorMessage(err, "L'envoi du fichier a échoué."));
    } finally {
      uploading = { ...uploading, [f.key]: false };
    }
  };

  onMount(load);
</script>

{#if editing}
  <form on:submit|preventDefault={save} class="grid grid-cols-1 gap-3 bg-white rounded-xl border border-gray-200 p-4">
    {#each fields as f (f.key)}
      {#if f.type === "checkbox"}
        <label class="flex items-center gap-2"><input type="checkbox" bind:checked={editing.values[f.key]} /> {f.label}</label>
      {:else}
        <label class="text-sm text-gray-500" for="mf-{f.key}">{f.label}{f.required ? " *" : ""}</label>
        {#if f.type === "textarea"}
          <textarea id="mf-{f.key}" rows={f.rows || 6} bind:value={editing.values[f.key]}></textarea>
        {:else if f.type === "select"}
          <select id="mf-{f.key}" bind:value={editing.values[f.key]}>
            {#each f.options() as o}<option value={o.value}>{o.label}</option>{/each}
          </select>
        {:else if f.type === "date"}
          <input id="mf-{f.key}" type="date" bind:value={editing.values[f.key]} />
        {:else if f.type === "datetime"}
          <input id="mf-{f.key}" type="datetime-local" bind:value={editing.values[f.key]} />
        {:else if f.type === "number"}
          <input id="mf-{f.key}" type="number" min="1" bind:value={editing.values[f.key]} />
        {:else if f.type === "upload"}
          <div class="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
            <input id="mf-{f.key}" class="md:col-span-2" type="url" placeholder="Lien (ou envoyez un fichier)" bind:value={editing.values[f.key]} />
            <input type="file" accept={f.kind === "image" ? "image/jpeg,image/png,image/webp" : f.kind === "audio" ? "audio/*" : "application/pdf"}
              on:change={(e) => onFile(f, e.target.files)} />
          </div>
          {#if uploading[f.key]}<div class="text-xs text-brand-primary animate-pulse">Envoi du fichier…</div>{/if}
          {#if f.kind === "image" && editing.values[f.key]}<img src={editing.values[f.key]} alt="" class="h-20 rounded object-cover" />{/if}
          {#if f.kind === "audio" && editing.values[f.key]}<audio controls src={editing.values[f.key]} class="w-full"></audio>{/if}
        {:else if f.type === "url"}
          <input id="mf-{f.key}" type="url" bind:value={editing.values[f.key]} placeholder={f.placeholder || ""} />
        {:else}
          <input id="mf-{f.key}" type="text" bind:value={editing.values[f.key]} placeholder={f.placeholder || ""} />
        {/if}
        {#if f.help}<div class="text-xs text-gray-500 -mt-2">{f.help}</div>{/if}
      {/if}
    {/each}
    <div class="flex gap-3">
      <button type="submit" class="btn btn-third !w-full" disabled={saving || Object.values(uploading).some(Boolean)}>
        {saving ? "Enregistrement..." : "Enregistrer"}
      </button>
      <button type="button" class="btn btn-aurora !w-full" on:click={() => (editing = null)}>Annuler</button>
    </div>
  </form>
{:else if items == null}
  <Loading text="Veuillez patienter" />
{:else}
  <button class="btn btn-primary mb-4" on:click={startNew}>{newLabel}</button>
  <div class="grid grid-cols-1 gap-2">
    {#each items as it (it.id)}
      <div class="flex flex-col md:flex-row md:items-center gap-3 bg-white rounded-lg border border-gray-200 px-3 py-2 text-sm">
        {#if itemImage(it)}<img src={cdn(itemImage(it), 120)} alt="" class="w-20 h-12 rounded object-cover" loading="lazy" />{/if}
        <div class="flex-1">
          <div class="font-bold text-gray-800">{itemTitle(it)}</div>
          <div class="text-xs text-gray-500">
            {#if publishable}
              <span class:text-green-700={it.is_published} class:text-orange-600={!it.is_published}>
                {it.is_published ? "Publié" : "Brouillon"}
              </span> ·
            {/if}
            {itemSubtitle(it)}
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <slot name="actions" item={it} reload={load} />
          <button class="btn btn-secondary !py-1 !text-xs" on:click={() => startEdit(it)}>Modifier</button>
          {#if publishable}
            {#if it.is_published}
              <button class="btn btn-aurora !py-1 !text-xs" on:click={() => act(it, "unpublish")}>Dépublier</button>
            {:else}
              <button class="btn btn-aurora !py-1 !text-xs" on:click={() => act(it, "publish")}>Publier</button>
            {/if}
          {/if}
          <button class="btn btn-aurora !py-1 !text-xs" on:click={() => act(it, "delete", `Supprimer définitivement « ${itemTitle(it)} » ?`)}>Supprimer</button>
        </div>
      </div>
    {:else}
      <Empty text="Rien pour le moment" />
    {/each}
  </div>
{/if}
