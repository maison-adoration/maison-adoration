<script>
  // État des services branchés (lecture seule). Aucun secret n'est transmis par l'API :
  // seulement « actif / inactif » et le nom des réglages à renseigner sur le serveur.
  import { onMount } from "svelte";
  import api, { errorMessage } from "../../utils/api";

  let data = null;
  let error = "";

  const load = async () => {
    error = "";
    data = null;
    try {
      data = (await api.get("/system/status")).data;
    } catch (err) {
      error = errorMessage(err, "L'état du système n'a pas pu être chargé.");
    }
  };
  onMount(load);

  $: active = data ? data.services.filter((s) => s.enabled).length : 0;
</script>

{#if error}
  <div class="rounded-2xl bg-white p-6 flex flex-col items-start gap-3">
    <p class="text-man-nuit">{error}</p>
    <button type="button" class="btn-line !min-h-[44px]" on:click={load}>Réessayer</button>
  </div>
{:else if data === null}
  <div class="grid md:grid-cols-2 gap-4" aria-busy="true" aria-label="Chargement">
    {#each [0, 1, 2, 3] as _}<div class="h-[130px] rounded-2xl bg-white animate-pulse"></div>{/each}
  </div>
{:else}
  <div class="flex flex-wrap gap-x-8 gap-y-2 mb-6 text-[#2B3F5C]">
    <p><strong class="text-man-nuit">{active} sur {data.services.length}</strong> services actifs</p>
    <p><strong class="text-man-nuit">{data.counts.users ?? 0}</strong> comptes, dont <strong class="text-man-nuit">{data.counts.team ?? 0}</strong> dans l'équipe</p>
    <p><strong class="text-man-nuit">{data.counts.pushSubscriptions ?? 0}</strong> appareils abonnés aux notifications</p>
    <p>Environnement : <strong class="text-man-nuit">{data.environment === "production" ? "production" : data.environment}</strong></p>
  </div>

  <ul class="grid md:grid-cols-2 gap-4">
    {#each data.services as s (s.key)}
      <li class="rounded-2xl bg-white p-5 border-l-4 {s.enabled ? 'border-[#1E7A4C]' : 'border-[#C9D6E8]'}">
        <div class="flex items-start justify-between gap-3">
          <h2 class="font-bold text-man-nuit text-[17px]">{s.label}</h2>
          <span class="shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[13px] font-bold {s.enabled ? 'bg-[#E7F6EE] text-[#0F4A2D]' : 'bg-[#EEF2F8] text-[#2B3F5C]'}">
            <span class="w-2 h-2 rounded-full {s.enabled ? 'bg-[#1E7A4C]' : 'bg-[#8A9BB5]'}" aria-hidden="true"></span>{s.enabled ? "Actif" : "Inactif"}
          </span>
        </div>
        {#if s.detail}<p class="mt-2 text-[15px] text-[#2B3F5C]">{s.detail}</p>{/if}
        {#if !s.enabled || s.key !== "database"}
          <details class="mt-3 text-[15px]">
            <summary class="cursor-pointer font-bold text-man-marine">{s.enabled ? "Réglages utilisés" : "Comment l'activer"}</summary>
            <p class="mt-2 text-[#2B3F5C]">Renseigner sur le serveur, dans le fichier <code>.env</code> du backend, puis redémarrer :</p>
            <ul class="mt-2 flex flex-wrap gap-1.5">
              {#each s.settings as name}<li><code class="rounded-lg bg-[#EEF2F8] px-2 py-0.5 text-[13px] text-man-nuit">{name}</code></li>{/each}
            </ul>
          </details>
        {/if}
      </li>
    {/each}
  </ul>
{/if}
