<script>
  // Suivi des demandes d'inscription Man Kids.
  import { onMount } from "svelte";
  import api, { errorMessage } from "../../utils/api";
  import { download, today } from "../../utils/download";
  import Loading from "../utils/Loading.svelte";
  import Empty from "../utils/Empty.svelte";

  const STATUSES = [
    { value: "", label: "En cours" },
    { value: "new", label: "Nouvelles" },
    { value: "contacted", label: "Contactées" },
    { value: "enrolled", label: "Inscrits" },
    { value: "archived", label: "Archivées" },
  ];
  const LABEL = { new: "Nouvelle", contacted: "Parent contacté", enrolled: "Inscrit", archived: "Archivée" };

  let status = "";
  let list = null;

  const load = async () => {
    list = null;
    try {
      const res = await api.get("/kids-registrations", { params: status ? { status } : {} });
      list = res.data;
    } catch (err) {
      list = [];
      alert(errorMessage(err));
    }
  };

  const setStatus = async (r, s) => {
    try {
      await api.put(`/kids-registrations/${r.id}`, { status: s });
      load();
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const remove = async (r) => {
    if (!confirm(`Supprimer définitivement la demande pour ${r.childName} ?`)) return;
    try {
      await api.delete(`/kids-registrations/${r.id}`);
      load();
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  onMount(load);
  let exporting = false;
  const exportXlsx = async () => {
    exporting = true;
    try {
      await download("/kids-registrations/export.xlsx", `man-kids-${today()}.xlsx`);
    } catch (err) {
      alert(errorMessage(err, "L'export n'a pas pu être préparé."));
    } finally {
      exporting = false;
    }
  };
</script>

<div class="flex flex-wrap items-center gap-2 mb-4">
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
  <button type="button" class="btn-line !min-h-[40px] !text-[14px] md:ml-auto" on:click={exportXlsx} disabled={exporting} aria-busy={exporting}>{exporting ? "Préparation…" : "Exporter en Excel"}</button>
</div>

{#if list == null}
  <Loading text="Veuillez patienter" />
{:else}
  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
    {#each list as r (r.id)}
      <div class="bg-white rounded-lg border border-gray-200 p-3 text-sm grid gap-1">
        <div class="flex justify-between">
          <span class="font-bold text-gray-800">{r.childName}, {r.childAge} an{r.childAge > 1 ? "s" : ""}</span>
          <span class="text-xs text-brand-primary">{LABEL[r.status]}</span>
        </div>
        <div>Parent : {r.parentName}</div>
        <div><a class="underline" href="tel:{r.parentPhone}">{r.parentPhone}</a>
          {#if r.parentEmail} · <a class="underline" href="mailto:{r.parentEmail}">{r.parentEmail}</a>{/if}</div>
        {#if r.notes}<div class="text-gray-600 whitespace-pre-line">📝 {r.notes}</div>{/if}
        <div class="text-xs text-gray-600">Reçue le {new Date(r.createdAt).toLocaleDateString("fr-FR")}</div>
        <div class="flex flex-wrap gap-2 mt-1">
          {#if r.status != "contacted"}<button class="btn btn-aurora !py-1 !text-xs" on:click={() => setStatus(r, "contacted")}>Contacté</button>{/if}
          {#if r.status != "enrolled"}<button class="btn btn-secondary !py-1 !text-xs" on:click={() => setStatus(r, "enrolled")}>Inscrit</button>{/if}
          {#if r.status != "archived"}<button class="btn btn-aurora !py-1 !text-xs" on:click={() => setStatus(r, "archived")}>Archiver</button>{/if}
          <button class="btn btn-aurora !py-1 !text-xs" on:click={() => remove(r)}>Supprimer</button>
        </div>
      </div>
    {:else}
      <div class="col-span-full"><Empty text="Aucune demande" /></div>
    {/each}
  </div>
{/if}
