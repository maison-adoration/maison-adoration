<script>
  // Équipe de prière : demandes reçues (direct et semaine) et personnes qui ont
  // répondu « J'ai donné ma vie à Christ », à rappeler et accompagner.
  import { onMount, createEventDispatcher } from "svelte";
  import api, { errorMessage } from "../../utils/api";
  import Modal from "../utils/Modal.svelte";
  import FormAlert from "../auth/FormAlert.svelte";
  import ExportButtons from "./ExportButtons.svelte";
  import { formatDate } from "./media/upload";

  const dispatch = createEventDispatcher();
  const P_STATUS = { new: "Nouvelle", praying: "En prière", answered: "Exaucée", archived: "Archivée" };
  const P_COLOR = { new: "bg-man-or text-man-nuit", praying: "bg-[#EAF3FB] text-man-marine", answered: "bg-[#E7F6EE] text-[#1E7A4C]", archived: "bg-[#EEF2F8] text-[#2B3F5C]" };
  const D_STATUS = { new: "À contacter", contacted: "Contacté", archived: "Archivé" };

  let view = "prayers";
  let prayers = null;
  let counts = {};
  let decisions = null;
  let filter = "";
  let notice = { text: "", kind: "success" };
  let deleting = null;

  async function load() {
    try {
      const [p, d] = await Promise.all([api.get("/prayer-requests", { params: filter ? { status: filter } : {} }), api.get("/faith-decisions")]);
      prayers = p.data.items;
      counts = p.data.counts;
      decisions = d.data;
      dispatch("counts", { prayers: counts.new || 0, decisions: decisions.filter((x) => x.status === "new").length });
    } catch (err) {
      notice = { text: errorMessage(err, "Les demandes n'ont pas pu être chargées."), kind: "error" };
      prayers = prayers || [];
      decisions = decisions || [];
    }
  }
  onMount(load);

  async function setPrayer(p, status) {
    try {
      await api.put(`/prayer-requests/${p.id}`, { status });
      load();
    } catch (err) {
      notice = { text: errorMessage(err), kind: "error" };
    }
  }
  async function setDecision(d, status) {
    try {
      await api.put(`/faith-decisions/${d.id}`, { status });
      load();
    } catch (err) {
      notice = { text: errorMessage(err), kind: "error" };
    }
  }
  async function remove() {
    const p = deleting;
    deleting = null;
    try {
      await api.delete(`/prayer-requests/${p.id}`);
      notice = { text: "Demande supprimée.", kind: "success" };
      load();
    } catch (err) {
      notice = { text: errorMessage(err), kind: "error" };
    }
  }
  const tel = (p) => `tel:${p.replace(/[^\d+]/g, "")}`;
  const wa = (p) => `https://wa.me/${p.replace(/\D/g, "")}`;
  $: newDecisions = decisions ? decisions.filter((d) => d.status === "new").length : 0;
</script>

<div class="flex flex-wrap items-center justify-between gap-3 mb-5">
  <div class="inline-flex rounded-full bg-white p-1" role="group" aria-label="Liste">
    <button type="button" aria-pressed={view === "prayers"} class="min-h-[44px] px-4 rounded-full font-bold transition-colors duration-150 {view === 'prayers' ? 'bg-man-nuit text-white' : 'text-[#2B3F5C]'}" on:click={() => (view = "prayers")}>
      Demandes de prière{counts.new ? ` (${counts.new})` : ""}</button>
    <button type="button" aria-pressed={view === "decisions"} class="min-h-[44px] px-4 rounded-full font-bold transition-colors duration-150 {view === 'decisions' ? 'bg-man-nuit text-white' : 'text-[#2B3F5C]'}" on:click={() => (view = "decisions")}>
      Décisions pour Christ{newDecisions ? ` (${newDecisions})` : ""}</button>
  </div>
  {#if view === "prayers"}
    <ExportButtons url={(f) => `/prayer-requests/export.${f}`} filename="demandes-de-priere" />
  {:else}
    <ExportButtons url={(f) => `/faith-decisions/export.${f}`} filename="decisions-pour-christ" pdfLabel="PDF de suivi" />
  {/if}
</div>

<div class="mb-4"><FormAlert light message={notice.text} kind={notice.kind} /></div>

{#if view === "prayers"}
  <div class="flex flex-wrap gap-1 mb-4" role="group" aria-label="Filtrer par statut">
    {#each [["", "Toutes"], ...Object.entries(P_STATUS)] as [v, l]}
      <button type="button" aria-pressed={filter === v} class="min-h-[36px] px-3 rounded-full text-[14px] font-bold transition-colors duration-150 {filter === v ? 'bg-man-marine text-white' : 'bg-white text-[#2B3F5C] hover:bg-[#EEF2F8]'}"
        on:click={() => ((filter = v), load())}>{l}{v && counts[v] ? ` (${counts[v]})` : ""}</button>
    {/each}
  </div>
  {#if prayers == null}
    <div class="grid gap-3" aria-busy="true" aria-label="Chargement">{#each [0, 1, 2] as _}<div class="h-[120px] rounded-2xl bg-white animate-pulse"></div>{/each}</div>
  {:else if !prayers.length}
    <div class="rounded-2xl bg-white p-8">
      <p class="font-slab font-bold text-[22px] text-man-nuit">Aucune demande{filter ? " avec ce statut" : ""}</p>
      <p class="text-[#2B3F5C] mt-1">Les demandes envoyées depuis la page Prière et pendant les directs arrivent ici.</p>
    </div>
  {:else}
    <ul class="grid gap-3">
      {#each prayers as p (p.id)}
        <li class="rounded-2xl bg-white p-5">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-bold text-man-nuit text-[17px]">{p.name}</span>
            <span class="rounded-full px-2.5 py-0.5 text-[13px] font-bold {P_COLOR[p.status]}">{P_STATUS[p.status]}</span>
            {#if p.wants_call}<span class="rounded-full px-2.5 py-0.5 text-[13px] font-bold bg-[#FDECEA] text-[#7A1A14]">Souhaite être appelé</span>{/if}
            <span class="text-[14px] text-[#4A6285] ml-auto">{formatDate(p.created_at, true)}{p.stream_title ? ` · ${p.stream_title}` : ""}</span>
          </div>
          <p class="mt-2 text-[#2B3F5C] whitespace-pre-line max-w-[75ch]">{p.request}</p>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            {#if p.phone}
              <a class="btn-line !min-h-[40px] !text-[14px]" href={tel(p.phone)}>Appeler {p.phone}</a>
              <a class="btn-line !min-h-[40px] !text-[14px]" href={wa(p.phone)} target="_blank" rel="noopener">WhatsApp</a>
            {/if}
            {#if p.status === "new"}<button type="button" class="btn-or !min-h-[40px] !text-[14px]" on:click={() => setPrayer(p, "praying")}>Prise en charge</button>{/if}
            {#if p.status === "praying"}<button type="button" class="btn-or !min-h-[40px] !text-[14px]" on:click={() => setPrayer(p, "answered")}>Marquer exaucée</button>{/if}
            {#if p.status !== "archived"}<button type="button" class="btn-line !min-h-[40px] !text-[14px]" on:click={() => setPrayer(p, "archived")}>Archiver</button>
            {:else}<button type="button" class="btn-line !min-h-[40px] !text-[14px]" on:click={() => setPrayer(p, "new")}>Rouvrir</button>{/if}
            <button type="button" class="min-h-[40px] px-3 text-[14px] font-bold text-[#B3261E] hover:underline" on:click={() => (deleting = p)}>Supprimer</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
{:else if decisions == null}
  <div class="h-[200px] rounded-2xl bg-white animate-pulse" aria-busy="true" aria-label="Chargement"></div>
{:else if !decisions.length}
  <div class="rounded-2xl bg-white p-8">
    <p class="font-slab font-bold text-[22px] text-man-nuit">Aucune décision enregistrée</p>
    <p class="text-[#2B3F5C] mt-1">Pendant un direct, l'équipe média affiche l'appel « J'ai donné ma vie à Christ » ; les réponses arrivent ici.</p>
  </div>
{:else}
  <ul class="grid gap-3">
    {#each decisions as d (d.id)}
      <li class="rounded-2xl bg-white p-5 flex flex-col md:flex-row md:items-center gap-3">
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-bold text-man-nuit text-[17px]">{d.name}</span>
            <span class="rounded-full px-2.5 py-0.5 text-[13px] font-bold {d.status === 'new' ? 'bg-man-or text-man-nuit' : d.status === 'contacted' ? 'bg-[#E7F6EE] text-[#1E7A4C]' : 'bg-[#EEF2F8] text-[#2B3F5C]'}">{D_STATUS[d.status]}</span>
            {#if !d.wants_contact}<span class="text-[14px] text-[#4A6285]">Ne souhaite pas être contacté</span>{/if}
          </div>
          <p class="text-[15px] text-[#4A6285]">{formatDate(d.created_at, true)}{d.stream_title ? ` · ${d.stream_title}` : ""}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          {#if d.phone}
            <a class="btn-line !min-h-[40px] !text-[14px]" href={tel(d.phone)}>Appeler</a>
            <a class="btn-line !min-h-[40px] !text-[14px]" href={wa(d.phone)} target="_blank" rel="noopener">WhatsApp</a>
          {/if}
          {#if d.status === "new"}<button type="button" class="btn-or !min-h-[40px] !text-[14px]" on:click={() => setDecision(d, "contacted")}>Marquer contacté</button>
          {:else if d.status === "contacted"}<button type="button" class="btn-line !min-h-[40px] !text-[14px]" on:click={() => setDecision(d, "archived")}>Archiver</button>
          {:else}<button type="button" class="btn-line !min-h-[40px] !text-[14px]" on:click={() => setDecision(d, "new")}>Rouvrir</button>{/if}
        </div>
      </li>
    {/each}
  </ul>
{/if}

<Modal show={Boolean(deleting)} title="Supprimer la demande ?" on:modalClose={() => (deleting = null)}>
  {#if deleting}
    <p class="text-[#2B3F5C]">La demande de <strong class="text-man-nuit">{deleting.name}</strong> sera effacée. Pour garder une trace, choisissez plutôt « Archiver ».</p>
    <button type="button" class="btn-or w-full mt-5 !bg-[#B3261E] !text-white" on:click={remove}>Supprimer définitivement</button>
  {/if}
</Modal>
