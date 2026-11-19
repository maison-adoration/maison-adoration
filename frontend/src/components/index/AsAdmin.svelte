<script>
  import Select from "svelte-select";
  import SectionHeading from "./../utils/SectionHeading.svelte";
  import Modal from "../utils/Modal.svelte";
  import Loading from "../utils/Loading.svelte";
  import Empty from "../utils/Empty.svelte";
  import { Wave } from "svelte-loading-spinners";
  import { onMount } from "svelte";
  import api, { CONTENT_TYPES, errorMessage } from "../../utils/api";
  import { resizeImage } from "../../utils/image";
  import ConferenceCard from "../shared/ConferenceCard.svelte";
  import get from "lodash.get";
  import config from "../../stores/config";

  let contents = null;
  let type = null; // { value, label }

  const emptyForm = () => ({ url: "", title: "", description: "", price: 0, poster: null, pdf: null });
  let newContent = emptyForm();

  let showAddForm = false;
  let addLoading = false;

  $: typeValue = get(type, "value");

  const handleAdd = async () => {
    if (!typeValue) return alert("Veuillez choisir le type de contenu.");
    if (!newContent.title.trim()) return alert("Veuillez saisir un titre.");
    if (!newContent.poster || !newContent.poster[0]) return alert("Veuillez ajouter une affiche.");
    if (typeValue == "pdf" && (!newContent.pdf || !newContent.pdf[0])) return alert("Veuillez ajouter le fichier PDF.");
    if ((typeValue == "video" || typeValue == "podcast") && !newContent.url.trim())
      return alert("Veuillez coller le lien YouTube.");

    addLoading = true;
    const formData = new FormData();
    formData.append("type", typeValue);
    formData.append("title", newContent.title.trim());
    formData.append("description", newContent.description.trim());
    formData.append("price", String(Number(newContent.price) || 0));
    if (typeValue == "pdf") formData.append("pdf", newContent.pdf[0]);
    else if (newContent.url.trim()) formData.append("url", newContent.url.trim());
    formData.append("poster", await resizeImage(newContent.poster[0]));

    try {
      await api.post("/contents", formData);
      showAddForm = false;
      newContent = emptyForm();
      type = null;
      fetchContents();
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      addLoading = false;
    }
  };

  const fetchContents = async () => {
    try {
      const res = await api.get("/contents", { params: { limit: 200 } });
      contents = res.data;
    } catch (err) {
      contents = [];
      alert(errorMessage(err));
    }
  };

  onMount(fetchContents);
</script>

<Modal
  show={showAddForm}
  on:modalClose={() => {
    showAddForm = false;
  }}
>
  <div class="grid gap-y-2">
    <div class="grid grid-cols-1 gap-2">
      <Select
        placeholder="Type"
        bind:selectedValue={type}
        items={CONTENT_TYPES}
      />

      {#if typeValue == "video" || typeValue == "podcast"}
        <input bind:value={newContent.url} type="url" placeholder="Lien YouTube" />
      {/if}

      <input bind:value={newContent.title} type="text" placeholder="Titre" />

      {#if typeValue != "activity"}
        <label class="text-gray-400 text-sm" for="new-price">
          Prix en {$config.settings.currency} (0 = gratuit)
        </label>
        <input id="new-price" bind:value={newContent.price} type="number" min="0" step="0.01" />
      {/if}

      <textarea bind:value={newContent.description} placeholder="Description" rows="4" />

      <div class="">
        <label
          for="course-poster"
          class:border-brand-primary={newContent.poster}
          class:text-brand-primary={newContent.poster}
          class:border-gray-100={!newContent.poster}
          class:text-gray-600={!newContent.poster}
          class="shadow-sm py-1 px-4 flex items-center justify-start cursor-pointer col-span-2 h-full bg-brand-black-light rounded-md border border-gray-800/50"
        >
          {#if newContent.poster}
            <ion-icon name="checkmark-circle-outline" class="mr-2 text-xl"
            ></ion-icon>
            Affiche sélectionnée
          {:else}
            <ion-icon name="image-outline" class="mr-2 text-xl"></ion-icon>
            Affiche (image)
          {/if}
        </label>
      </div>

      <div class="hidden">
        <input
          bind:files={newContent.poster}
          type="file"
          accept="image/*"
          id="course-poster"
          class="appearance-none"
        />
      </div>

      {#if typeValue == "pdf"}
        <div class="">
          <label
            for="course-pdf"
            class:border-brand-primary={newContent.pdf}
            class:text-brand-primary={newContent.pdf}
            class:border-gray-100={!newContent.pdf}
            class:text-gray-600={!newContent.pdf}
            class="shadow-sm py-1 px-4 flex items-center justify-start cursor-pointer col-span-2 h-full bg-brand-black-light rounded-md border"
          >
            {#if newContent.pdf}
              <ion-icon name="checkmark-circle" class="text-2xl mr-2" />
              PDF sélectionné
            {:else}
              <ion-icon name="document-attach" class="text-2xl mr-2" />
              PDF
            {/if}
          </label>
        </div>

        <div class="hidden">
          <input
            bind:files={newContent.pdf}
            type="file"
            accept="application/pdf"
            id="course-pdf"
            class="appearance-none"
          />
        </div>
      {/if}

      {#if addLoading}
        <div class="grid grid-cols-1 gap-8 !w-full">
          <div class="btn btn-primary !w-full">
            <Wave size="25" unit="px" color="#3695cb" />
            <span class="ml-4">Veuillez Patienter</span>
          </div>
        </div>
      {:else}
        <!-- else content here -->
        <div class="flex">
          <button class=" !w-full btn btn-third" on:click={handleAdd}>
            <ion-icon name="checkmark-circle" class="text-2xl mr-2" />
            Fait
          </button>
          <button
            class="ml-4 !w-full btn btn-aurora"
            on:click={() => (showAddForm = false)}
          >
            <ion-icon name="close-circle" class="text-2xl mr-2" />
            Fermer
          </button>
        </div>
      {/if}
    </div>
  </div>
</Modal>

<div class="hidden border-gray-100 text-gray-600" />
<div class="hidden border-brand-primary text-brand-primary" />

<div class="mt-8"></div>

<SectionHeading text1="Contenu" text2="Ajouté..." breakWord />

<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
  <button
    class="btn btn-primary !w-full"
    on:click={() => (showAddForm = true)}
  >
    <ion-icon name="add-circle" class="text-2xl mr-3" />
    Ajouter du Contenu
  </button>
</div>

{#if contents == null}
  <Loading text="Veuillez Patienter" />
{:else}
  <div class="my-6 grid grid-cols-1 md:grid-cols-2 gap-4">
    {#each contents as content (content.id)}
      <ConferenceCard {...content} on:delete={fetchContents} on:update={fetchContents} />
    {:else}
      <div class="col-span-full">
        <Empty text="Aucun contenu pour le moment" />
      </div>
    {/each}
  </div>
{/if}
