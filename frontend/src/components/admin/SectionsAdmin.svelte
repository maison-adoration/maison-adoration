<script>
  // Édition des pages de contenu : Maison, Ministères, Extensions, Dons.
  import { onMount } from "svelte";
  import api, { errorMessage } from "../../utils/api";
  import { resizeImage } from "../../utils/image";
  import Loading from "../utils/Loading.svelte";

  const PAGES = [
    { value: "maison", label: "Maison", url: "/maison" },
    { value: "ministeres", label: "Ministères", url: "/ministeres" },
    { value: "extensions", label: "Extensions", url: "/extensions" },
    { value: "dons", label: "Dons", url: "/donate" },
  ];

  let page = "maison";
  let sections = null;
  let editing = null; // copie de la section en cours de modification
  let saving = false;

  const load = async () => {
    sections = null;
    try {
      const res = await api.get("/sections", { params: { page } });
      sections = res.data;
    } catch (err) {
      sections = [];
      alert(errorMessage(err));
    }
  };

  const edit = (s) => {
    editing = JSON.parse(JSON.stringify(s));
    newImage = null;
  };

  const save = async () => {
    if (!editing.title || editing.title.trim().length < 2) return alert("Le titre est obligatoire.");
    saving = true;
    try {
      const body = {
        title: editing.title,
        subtitle: editing.subtitle || "",
        body: editing.body || "",
        position: Number(editing.position) || 0,
        published: editing.published,
        details: (editing.details || []).filter((d) => d.label && d.label.trim()),
      };
      if (editing.id) await api.put(`/sections/${editing.id}`, body);
      else
        await api.post("/sections", {
          ...body,
          page,
          slug: editing.slug,
        });
      editing = null;
      load();
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      saving = false;
    }
  };

  const remove = async (s) => {
    if (!confirm(`Supprimer définitivement la section « ${s.title} » ?`)) return;
    try {
      await api.delete(`/sections/${s.id}`);
      load();
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const togglePublished = async (s) => {
    try {
      await api.put(`/sections/${s.id}`, { published: !s.published });
      load();
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  // Identifiant d'URL généré à partir du titre (nouvelle section)
  const slugify = (t) =>
    t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

  const newSection = () => {
    const last = (sections || []).reduce((m, s) => Math.max(m, s.position), 0);
    editing = { title: "", subtitle: "", body: "", details: [], position: last + 10, published: false, slug: "" };
  };

  $: if (editing && !editing.id) editing.slug = slugify(editing.title || "");

  // Image de la section
  let newImage = null;
  let imageBusy = false;

  const uploadImage = async () => {
    imageBusy = true;
    try {
      const fd = new FormData();
      fd.append("poster", await resizeImage(newImage[0]));
      const res = await api.put(`/sections/${editing.id}/image`, fd);
      editing.imageUrl = res.data.imageUrl;
      newImage = null;
      load();
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      imageBusy = false;
    }
  };

  const removeImage = async () => {
    if (!confirm("Retirer l'image de cette section ?")) return;
    try {
      await api.put(`/sections/${editing.id}/image?remove=1`);
      editing.imageUrl = null;
      load();
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  onMount(load);
</script>

<div class="flex flex-wrap items-center gap-2 mb-4">
  {#each PAGES as p}
    <button
      class="px-3 py-1 rounded-full border text-sm"
      class:bg-brand-primary={page == p.value}
      class:text-white={page == p.value}
      class:border-brand-primary={page == p.value}
      on:click={() => {
        page = p.value;
        editing = null;
        load();
      }}>{p.label}</button
    >
  {/each}
  <a class="ml-auto text-sm underline text-brand-primary" href={PAGES.find((p) => p.value == page).url} target="_blank">
    Voir la page ↗
  </a>
</div>

{#if editing}
  <form on:submit|preventDefault={save} class="grid grid-cols-1 gap-3 bg-white rounded-xl border border-gray-200 p-4">
    <div class="h-font text-2xl text-brand-primary">{editing.id ? "Modifier la section" : "Nouvelle section"}</div>
    <label class="text-sm text-gray-500" for="sec-title">Titre *</label>
    <input id="sec-title" bind:value={editing.title} maxlength="150" />
    {#if !editing.id}
      <div class="text-xs text-gray-500">Identifiant (adresse) : <code>{editing.slug || "…"}</code></div>
    {/if}
    <label class="text-sm text-gray-500" for="sec-sub">Sous-titre</label>
    <input id="sec-sub" bind:value={editing.subtitle} maxlength="200" />
    <label class="text-sm text-gray-500" for="sec-body">Texte (les retours à la ligne sont conservés)</label>
    <textarea id="sec-body" bind:value={editing.body} rows="10" maxlength="20000" />

    <div class="text-sm text-gray-500">Informations pratiques (adresse, numéro de compte, horaires…)</div>
    {#each editing.details as d, i}
      <div class="grid grid-cols-5 gap-2">
        <input class="col-span-2" bind:value={d.label} placeholder="Libellé (ex. Adresse)" maxlength="80" />
        <input class="col-span-2" bind:value={d.value} placeholder="Valeur" maxlength="300" />
        <button type="button" class="btn btn-aurora !px-2" on:click={() => (editing.details = editing.details.filter((_, j) => j != i))}>
          Retirer
        </button>
      </div>
    {/each}
    <button type="button" class="btn btn-aurora" on:click={() => (editing.details = [...editing.details, { label: "", value: "" }])}>
      + Ajouter une information
    </button>
    <p class="text-xs text-gray-500">Les informations sans valeur ne sont pas affichées aux visiteurs.</p>

    <div class="grid grid-cols-2 gap-3 items-center">
      <label class="flex items-center gap-2">
        <input type="checkbox" bind:checked={editing.published} />
        Publiée (visible sur le site)
      </label>
      <label class="flex items-center gap-2 text-sm text-gray-500">
        Ordre
        <input type="number" bind:value={editing.position} min="0" class="w-24" />
      </label>
    </div>

    {#if editing.id}
      <div class="flex flex-wrap items-center gap-3">
        {#if editing.imageUrl}
          <img src={editing.imageUrl} alt="" class="h-16 rounded" />
          <button type="button" class="btn btn-aurora" on:click={removeImage}>Retirer l'image</button>
        {/if}
        <input type="file" accept="image/jpeg,image/png,image/webp" bind:files={newImage} />
        {#if newImage && newImage[0]}
          <button type="button" class="btn btn-secondary" on:click={uploadImage} disabled={imageBusy}>
            {imageBusy ? "Envoi..." : "Envoyer l'image"}
          </button>
        {/if}
      </div>
    {:else}
      <p class="text-xs text-gray-500">L'image pourra être ajoutée après l'enregistrement.</p>
    {/if}

    <div class="flex gap-3">
      <button type="submit" class="btn btn-third !w-full" disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}</button>
      <button type="button" class="btn btn-aurora !w-full" on:click={() => (editing = null)}>Annuler</button>
    </div>
  </form>
{:else if sections == null}
  <Loading text="Veuillez patienter" />
{:else}
  <button class="btn btn-primary mb-4" on:click={newSection}>+ Nouvelle section</button>
  <div class="grid grid-cols-1 gap-2">
    {#each sections as s (s.id)}
      <div class="flex flex-col sm:flex-row sm:items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2">
        <div class="flex-1">
          <div class="font-bold text-gray-800">{s.title}</div>
          <div class="text-xs" class:text-green-700={s.published} class:text-orange-600={!s.published}>
            {s.published ? "Publiée" : "Brouillon — non visible"}
            {#if !s.body && !(s.details || []).some((d) => d.value)} · à compléter{/if}
          </div>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-secondary !py-1 !text-xs" on:click={() => edit(s)}>Modifier</button>
          <button class="btn btn-aurora !py-1 !text-xs" on:click={() => togglePublished(s)}>
            {s.published ? "Masquer" : "Publier"}
          </button>
          <button class="btn btn-aurora !py-1 !text-xs" on:click={() => remove(s)}>Supprimer</button>
        </div>
      </div>
    {/each}
  </div>
{/if}
