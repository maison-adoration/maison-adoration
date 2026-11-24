<script>
  // Premières visites annoncées depuis l'accueil : l'équipe d'accueil les suit ici.
  import { onMount } from "svelte";
  import api, { errorMessage } from "../../utils/api";
  import Loading from "../utils/Loading.svelte";
  import Empty from "../utils/Empty.svelte";

  const STATUSES = [
    { value: "", label: "À accueillir et accueillies" },
    { value: "new", label: "À accueillir" },
    { value: "welcomed", label: "Accueillies" },
    { value: "archived", label: "Archivées" },
  ];
  const LABEL = { new: "À accueillir", welcomed: "Accueillie", archived: "Archivée" };
  const DAY = { mer: "Mercredi, 16h30", ven: "Vendredi, 16h30", dim: "Dimanche, 8h30" };

  let status = "";
  let list = null;

  const load = async () => {
    list = null;
    try {
      list = (await api.get("/visits", { params: status ? { status } : {} })).data;
    } catch (err) {
      list = [];
      alert(errorMessage(err));
    }
  };

  const setStatus = async (v, s) => {
    try {
      await api.put(`/visits/${v.id}`, { status: s });
      load();
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const remove = async (v) => {
    if (!confirm(`Supprimer définitivement la visite de ${v.name} ? Cette action est irréversible.`)) return;
    try {
      await api.delete(`/visits/${v.id}`);
      load();
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const wa = (phone) => `https://wa.me/${phone.replace(/[^\d]/g, "")}`;
  onMount(load);
</script>

<div class="flex flex-wrap gap-2 mb-4">
  {#each STATUSES as s}
    <button
      class="px-3 py-1 rounded-full border text-sm"
      class:bg-brand-primary={status == s.value}
      class:text-white={status == s.value}
      on:click={() => {
        status = s.value;
        load();
      }}>{s.label}</button
    >
  {/each}
</div>

{#if list == null}
  <Loading text="Veuillez patienter" />
{:else}
  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
    {#each list as v (v.id)}
      <div class="bg-white rounded-lg border border-gray-200 p-3 text-sm grid gap-1">
        <div class="flex justify-between">
          <span class="font-bold text-gray-800">{v.name}</span>
          <span class="text-xs text-brand-primary">{LABEL[v.status]}</span>
        </div>
        <div>Vient : {DAY[v.day]}</div>
        {#if v.phone}
          <div><a class="underline" href="tel:{v.phone}">{v.phone}</a> · <a class="underline" href={wa(v.phone)} target="_blank" rel="noopener">WhatsApp</a></div>
        {/if}
        <div class="text-xs text-gray-500">Annoncée le {new Date(v.createdAt).toLocaleDateString("fr-FR")}</div>
        <div class="flex flex-wrap gap-2 mt-1">
          {#if v.status != "welcomed"}<button class="btn btn-secondary !py-1 !text-xs" on:click={() => setStatus(v, "welcomed")}>Accueillie</button>{/if}
          {#if v.status != "archived"}<button class="btn btn-aurora !py-1 !text-xs" on:click={() => setStatus(v, "archived")}>Archiver</button>{/if}
          <button class="btn btn-aurora !py-1 !text-xs" on:click={() => remove(v)}>Supprimer</button>
        </div>
      </div>
    {:else}
      <div class="col-span-full"><Empty text="Aucune visite annoncée" /></div>
    {/each}
  </div>
{/if}
