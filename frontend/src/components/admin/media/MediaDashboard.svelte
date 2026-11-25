<script>
  // Accueil de l'équipe média : ce qui est en cours et ce qui reste à faire.
  import { onMount, createEventDispatcher } from "svelte";
  import api, { errorMessage } from "../../../utils/api";
  import { formatDate } from "./upload";

  const dispatch = createEventDispatcher();
  let data = null;
  let failed = "";
  onMount(async () => {
    try {
      data = (await api.get("/media/dashboard")).data;
    } catch (err) {
      failed = errorMessage(err, "Le tableau de bord n'a pas pu être chargé.");
    }
  });

  $: st = data && data.stats;
  $: live = data && data.upcomingStreams.find((s) => s.is_live);
  $: todo = st
    ? [
        st.draftSermons && { n: st.draftSermons, t: `message${st.draftSermons > 1 ? "s" : ""} en brouillon`, tab: "sermons" },
        st.scheduledSermons && { n: st.scheduledSermons, t: `publication${st.scheduledSermons > 1 ? "s" : ""} programmée${st.scheduledSermons > 1 ? "s" : ""}`, tab: "sermons" },
        st.sermonsWithoutAudio && { n: st.sermonsWithoutAudio, t: `message${st.sermonsWithoutAudio > 1 ? "s" : ""} en ligne sans audio (écoute et téléchargement indisponibles)`, tab: "sermons" },
        st.incompleteSermons && { n: st.incompleteSermons, t: `message${st.incompleteSermons > 1 ? "s" : ""} sans image ou sans vidéo`, tab: "sermons" },
      ].filter(Boolean)
    : [];
</script>

{#if failed}
  <p class="rounded-2xl bg-[#FDECEA] text-[#7A1A14] px-4 py-3" role="alert">{failed}</p>
{:else if data == null}
  <div class="grid md:grid-cols-2 gap-5" aria-busy="true" aria-label="Chargement">{#each [0, 1] as _}<div class="h-[220px] rounded-[22px] bg-white animate-pulse"></div>{/each}</div>
{:else}
  {#if live}
    <div class="mb-5 rounded-[22px] bg-man-nuit text-white p-5 md:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
      <p class="flex-1 min-w-0"><span class="inline-flex items-center gap-2 font-extrabold text-man-lumiere"><span class="man-live w-2.5 h-2.5 rounded-full bg-man-lumiere" aria-hidden="true"></span>En direct</span>
        <span class="block font-slab font-bold text-[24px] leading-tight">{live.title}</span></p>
      <button type="button" class="btn-or" on:click={() => dispatch("open", { tab: "streams", streamId: live.id })}>Ouvrir la régie</button>
    </div>
  {/if}
  <div class="grid md:grid-cols-2 gap-5">
    <section class="rounded-[22px] bg-white p-6" aria-labelledby="db-todo">
      <h2 id="db-todo" class="font-slab font-bold text-[22px] text-man-nuit">À faire</h2>
      {#if todo.length}
        <ul class="mt-3 grid gap-2">
          {#each todo as x}
            <li><button type="button" class="w-full text-left flex items-baseline gap-3 rounded-2xl px-3 py-2 hover:bg-[#F3F6FA] transition-colors duration-150" on:click={() => dispatch("open", { tab: x.tab })}>
              <span class="font-slab font-bold text-[24px] text-man-marine tabular-nums">{x.n}</span><span class="text-[#2B3F5C]">{x.t}</span></button></li>
          {/each}
        </ul>
      {:else}
        <p class="mt-3 text-[#2B3F5C]">Tout est à jour.</p>
      {/if}
    </section>
    <section class="rounded-[22px] bg-white p-6" aria-labelledby="db-next">
      <h2 id="db-next" class="font-slab font-bold text-[22px] text-man-nuit">Prochains directs</h2>
      <ul class="mt-3 grid gap-2">
        {#each data.upcomingStreams.filter((s) => !s.is_live) as s (s.id)}
          <li class="rounded-2xl bg-[#F3F6FA] px-4 py-3"><span class="block font-bold text-man-nuit">{s.title}</span><span class="text-[15px] text-[#4A6285]">{formatDate(s.scheduled_at, true)}</span></li>
        {:else}
          <li class="text-[#2B3F5C]">Aucun direct programmé. <button type="button" class="font-bold text-man-marine underline" on:click={() => dispatch("open", { tab: "streams" })}>Programmer un direct</button></li>
        {/each}
      </ul>
    </section>
    <section class="rounded-[22px] bg-white p-6 md:col-span-2" aria-labelledby="db-recent">
      <h2 id="db-recent" class="font-slab font-bold text-[22px] text-man-nuit">Derniers messages ajoutés</h2>
      <ul class="mt-3 divide-y divide-[#E1E8F1]">
        {#each data.recentSermons as s (s.id)}
          <li class="py-2 flex flex-wrap items-baseline gap-x-3"><span class="font-bold text-man-nuit">{s.title}</span><span class="text-[15px] text-[#4A6285]">{[formatDate(s.sermon_date), s.preacher].filter(Boolean).join(", ")}</span>
            <span class="ml-auto rounded-full px-2.5 py-0.5 text-[13px] font-bold {s.is_published ? 'bg-[#E7F6EE] text-[#1E7A4C]' : 'bg-[#FFF4D6] text-[#7A5600]'}">{s.is_published ? (new Date(s.published_at) > new Date() ? "Programmé" : "En ligne") : "Brouillon"}</span></li>
        {:else}
          <li class="py-2 text-[#2B3F5C]">Aucun message pour l'instant.</li>
        {/each}
      </ul>
    </section>
  </div>
{/if}
