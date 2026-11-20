<script>
  import { cdn } from "../../../utils/cdn.js";
  // Photos d'un album : envoi multiple, légende, suppression.
  import { onMount, createEventDispatcher } from "svelte";
  import api, { errorMessage } from "../../../utils/api";
  import { uploadMediaFile } from "./upload";
  import Loading from "../../utils/Loading.svelte";

  export let albumId;
  const dispatch = createEventDispatcher();

  let album = null;
  let progress = null; // "3 / 12"

  const load = async () => {
    try {
      album = (await api.get(`/media/gallery/${albumId}`)).data;
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const addFiles = async (files) => {
    if (!files || !files.length) return;
    const list = Array.from(files);
    const urls = [];
    try {
      for (let i = 0; i < list.length; i++) {
        progress = `${i + 1} / ${list.length}`;
        urls.push(await uploadMediaFile(list[i], "image"));
      }
      await api.post(`/media/gallery/${albumId}/photos`, { photos: urls.map((url) => ({ url })) });
    } catch (err) {
      alert(errorMessage(err, "Envoi interrompu."));
      if (urls.length) await api.post(`/media/gallery/${albumId}/photos`, { photos: urls.map((url) => ({ url })) }).catch(() => {});
    } finally {
      progress = null;
      load();
      dispatch("change");
    }
  };

  const caption = async (p) => {
    const c = prompt("Légende de la photo :", p.caption || "");
    if (c === null) return;
    try {
      await api.put(`/media/photos/${p.id}`, { caption: c });
      load();
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const remove = async (p) => {
    if (!confirm("Supprimer cette photo ?")) return;
    try {
      await api.delete(`/media/photos/${p.id}`);
      load();
      dispatch("change");
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  onMount(load);
</script>

<div class="bg-white rounded-xl border border-gray-200 p-4">
  <div class="flex flex-wrap items-center gap-3 mb-4">
    <button class="btn btn-aurora" on:click={() => dispatch("close")}>← Retour aux albums</button>
    <div class="h-font text-2xl text-brand-primary">{album ? album.title : ""}</div>
    <label class="btn btn-secondary ml-auto cursor-pointer">
      {progress ? `Envoi ${progress}…` : "+ Ajouter des photos"}
      <input type="file" accept="image/jpeg,image/png,image/webp" multiple class="hidden" disabled={Boolean(progress)}
        on:change={(e) => addFiles(e.target.files)} />
    </label>
  </div>
  {#if album == null}
    <Loading text="Veuillez patienter" />
  {:else}
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      {#each album.photos as p (p.id)}
        <div class="rounded-lg overflow-hidden border border-gray-200">
          <img src={cdn(p.url, 250)} alt={p.caption} class="w-full h-32 object-cover" loading="lazy" />
          <div class="p-2 text-xs text-gray-600 truncate">{p.caption || "—"}</div>
          <div class="flex gap-1 p-2 pt-0">
            <button class="btn btn-aurora !py-1 !text-xs !w-full" on:click={() => caption(p)}>Légende</button>
            <button class="btn btn-aurora !py-1 !text-xs !w-full" on:click={() => remove(p)}>Supprimer</button>
          </div>
        </div>
      {:else}
        <p class="col-span-full text-gray-500">Aucune photo. Ajoutez-en avec le bouton ci-dessus.</p>
      {/each}
    </div>
  {/if}
</div>
