<script>
  import { cdn } from "../../utils/cdn.js";
  // Carte d'un contenu dans l'espace admin : modifier, supprimer, affiche,
  // acheteurs, accès manuel, annonces (e-mail / SMS / push).
  import Select from "svelte-select";
  import { createEventDispatcher } from "svelte";
  import Modal from "../utils/Modal.svelte";
  import Loading from "../utils/Loading.svelte";
  import Empty from "../utils/Empty.svelte";
  import { Wave } from "svelte-loading-spinners";
  import ParticipantCard from "./ParticipantCard.svelte";
  import api, { CONTENT_TYPES, typeLabel, errorMessage } from "../../utils/api";
  import { resizeImage } from "../../utils/image";
  import config from "../../stores/config";

  const dispatch = createEventDispatcher();

  export let id;
  export let type;
  export let title;
  export let description;
  export let price;
  export let posterUrl;
  export let url = null;

  // ----- Modification -----
  let showEditForm = false;
  let editLoading = false;
  let edit = {};
  let editType = null;

  const openEdit = () => {
    edit = { title, description, price, url: url || "" };
    editType = CONTENT_TYPES.find((t) => t.value === type) || null;
    showEditForm = true;
  };

  const handleUpdate = async () => {
    if (!edit.title || !edit.title.trim()) return alert("Le titre est obligatoire.");
    editLoading = true;
    const body = {
      type: editType ? editType.value : type,
      title: edit.title.trim(),
      description: (edit.description || "").trim(),
      price: Number(edit.price) || 0,
    };
    if (type !== "pdf" && edit.url && edit.url.trim()) body.url = edit.url.trim();
    try {
      await api.put(`/contents/${id}`, body);
      showEditForm = false;
      dispatch("update");
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      editLoading = false;
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Supprimer « ${title} » ?`)) return;
    try {
      await api.delete(`/contents/${id}`);
      dispatch("delete");
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  // ----- Annonces -----
  const CHANNEL_LABEL = { email: "e-mail", sms: "SMS", push: "notification push" };

  const handleNotify = async (channel) => {
    if (!confirm(`Annoncer « ${title} » par ${CHANNEL_LABEL[channel]} à tous les inscrits ?`)) return;
    try {
      const res = await api.post(`/contents/${id}/notify`, { channel });
      alert(`✅ Envoyé : ${res.data.sent} / ${res.data.recipients}${res.data.failed ? ` (${res.data.failed} échec(s))` : ""}`);
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  // ----- Acheteurs -----
  let showParticipants = false;
  let participants = null;
  let loadingParticipants = false;

  const fetchParticipants = async () => {
    loadingParticipants = true;
    try {
      const res = await api.get(`/contents/${id}/participants`);
      participants = res.data;
    } catch (err) {
      participants = [];
      alert(errorMessage(err));
    } finally {
      loadingParticipants = false;
    }
  };

  const handleManualAdd = async () => {
    let email = prompt("E-mail de la personne à qui donner l'accès :");
    if (!email) return;
    try {
      await api.post(`/contents/${id}/enrollments`, { email: email.trim().toLowerCase() });
      alert("✅ Accès donné");
      if (showParticipants) fetchParticipants();
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  // ----- Affiche -----
  let newPoster;
  let posterLoading = false;

  const handleEditPoster = async () => {
    const formData = new FormData();
    formData.append("poster", await resizeImage(newPoster[0]));
    posterLoading = true;
    try {
      await api.put(`/contents/${id}/poster`, formData);
      newPoster = null;
      alert("✅ L'affiche a été changée");
      dispatch("update");
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      posterLoading = false;
    }
  };
</script>

<!-- Modification -->
<Modal show={showEditForm} on:modalClose={() => (showEditForm = false)}>
  <div class="grid grid-cols-1 gap-2">
    <Select placeholder="Type" bind:value={editType} items={CONTENT_TYPES} />

    {#if type == "video" || type == "podcast"}
      <input bind:value={edit.url} type="url" placeholder="Lien YouTube" />
    {/if}

    <input bind:value={edit.title} type="text" placeholder="Titre" />

    <label class="text-gray-400 text-sm" for="price-{id}">
      Prix en {$config.settings.currency} (0 = gratuit)
    </label>
    <input id="price-{id}" bind:value={edit.price} type="number" min="0" step="0.01" />

    <textarea bind:value={edit.description} placeholder="Description" rows="4"></textarea>

    {#if editLoading}
      <div class="btn btn-primary !w-full">
        <Wave size="25" unit="px" color="#3695cb" />
        <span class="ml-4">Veuillez patienter</span>
      </div>
    {:else}
      <button class="!w-full btn btn-third" on:click={handleUpdate}>
        <ion-icon name="checkmark-circle" class="text-2xl mr-2"></ion-icon>
        Enregistrer
      </button>
    {/if}
  </div>
</Modal>

<!-- Acheteurs -->
<Modal show={showParticipants} on:modalClose={() => (showParticipants = false)}>
  {#if loadingParticipants || participants == null}
    <Loading text="Veuillez patienter" />
  {:else}
    <div class="max-h-[65vh] overflow-y-auto grid grid-cols-1 gap-3">
      {#each participants as p (p.id)}
        <ParticipantCard {...p} />
      {:else}
        <Empty text="Aucun acheteur" />
      {/each}
    </div>
  {/if}
</Modal>

<div
  class="px-2 py-2 rounded-md shadow-sm bg-brand-black-light flex flex-col justify-between border border-gray-300/20"
>
  <div class="flex items-center mb-4">
    <h1 class="flex items-center uppercase tracking-wider text-brand-primary text-sm">
      {title}
      <div class="rounded-md px-2 py-1 text-xs shadow-sm ml-2 border border-gray-400/30">
        {typeLabel(type)}
      </div>
      {#if price > 0}
        <div class="rounded-md px-2 py-1 text-xs shadow-sm ml-2 border border-gray-400/30">
          {price} {$config.settings.currency}
        </div>
      {/if}
    </h1>
  </div>

  <div class="line-clamp-3 text-sm whitespace-pre-line">{description}</div>

  {#if price > 0}
    <div class="mt-2 grid grid-cols-2 gap-2">
      <button
        on:click={() => {
          showParticipants = true;
          fetchParticipants();
        }}
        class="btn btn-green !w-full !py-[0.4rem] !text-xs"
        title="Voir les acheteurs"
      >
        <ion-icon name="wallet" class="text-base mr-2"></ion-icon>
        Acheteurs
      </button>
      <button
        on:click={handleManualAdd}
        class="btn btn-green !w-full !py-[0.4rem] !text-xs"
        title="Donner l'accès à quelqu'un via son e-mail"
      >
        <ion-icon name="add-circle" class="text-base mr-2"></ion-icon>
        Donner l'accès
      </button>
    </div>
  {/if}

  <div class="mt-2 grid grid-cols-2 gap-2">
    <button
      on:click={openEdit}
      class="btn bg-brand-black !text-gray-800 border border-gray-500/25 !w-full !py-[0.4rem] !text-xs"
    >
      <ion-icon name="pencil" class="text-base mr-2"></ion-icon>
      Modifier
    </button>
    <button
      on:click={handleDelete}
      class="btn bg-brand-black !text-gray-800 border border-gray-500/25 !w-full !py-[0.4rem] !text-xs"
    >
      <ion-icon name="close-circle" class="text-base mr-2"></ion-icon>
      Supprimer
    </button>
  </div>

  <div class="mt-2 grid grid-cols-3 gap-2">
    <button on:click={() => handleNotify("email")} class="btn bg-brand-primary !w-full !py-[0.4rem] !text-xs" title="Annoncer par e-mail">
      📧 E-mail
    </button>
    <button on:click={() => handleNotify("sms")} class="btn bg-brand-primary !w-full !py-[0.4rem] !text-xs" title="Annoncer par SMS">
      📱 SMS
    </button>
    <button on:click={() => handleNotify("push")} class="btn bg-brand-primary !w-full !py-[0.4rem] !text-xs" title="Annoncer par notification push">
      🔔 Push
    </button>
  </div>

  <div class="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
    <div class:col-span-full={!newPoster}>
      <label
        for="new-poster-{id}"
        class:border-brand-primary={newPoster}
        class:text-brand-primary={newPoster}
        class:text-gray-400={!newPoster}
        class="text-xs shadow-sm py-1 px-4 flex items-center justify-center cursor-pointer h-full bg-brand-black rounded-md border border-gray-500/25"
      >
        {#if newPoster}
          <ion-icon name="checkmark-circle-outline" class="mr-2 text-xl"></ion-icon>
          Affiche sélectionnée
        {:else}
          <img class="w-10 h-8 object-cover mr-2" src={cdn(posterUrl, 80)} alt="affiche" />
          Changer l'affiche
        {/if}
      </label>
    </div>

    {#if newPoster}
      <button on:click={handleEditPoster} class="btn btn-secondary !w-full !py-[0.4rem] !text-xs">
        {posterLoading ? "Veuillez patienter..." : "Enregistrer"}
        <ion-icon name="send" class="ml-2 text-xl"></ion-icon>
      </button>
    {/if}
  </div>
</div>

<div class="hidden">
  <input
    bind:files={newPoster}
    type="file"
    accept="image/jpeg,image/png,image/webp"
    id="new-poster-{id}"
    class="appearance-none"
  />
</div>
